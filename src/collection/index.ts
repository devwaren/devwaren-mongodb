
import type {
	Db,
	DeleteOptions,
	Filter,
	FilterOperators,
	FindOptions,
	FindOneAndUpdateOptions,
	InsertManyResult,
	InsertOneResult,
	OptionalUnlessRequiredId,
	Sort,
	UpdateFilter,
	UpdateOptions,
	WithId,
} from "mongodb";

import type { ZodType } from "zod/v3";
import type {
	CollectionLimit,
	CollectionService,
	CollectionDocument,
} from "./types";

export type CollectionConfig<
	T extends Record<string, unknown>,
> = {
	name: string;
	schema: ZodType<CollectionDocument<T>>;
	searchField?: keyof T & string;
	defaultSortBy?: keyof T & string;
};

const assertServer = () => {
	if (
		typeof globalThis !== "undefined" &&
		"window" in globalThis
	) {
		throw new Error(
			"MongoDB collection should only be used on the server.",
		);
	}
};

export const collection = (db: Db) => <
	T extends Record<string, unknown>,
>({
	name,
	schema,
	searchField = "title" as keyof T & string,
	defaultSortBy = "createdAt" as keyof T & string,
}: CollectionConfig<T>): CollectionService<T> => {
	assertServer();

	type Document = CollectionDocument<T>;

	const mongoCollection = db.collection<Document>(name);

	/**
	 * Validate a complete document while preserving MongoDB's native _id.
	 */
	const parse = (document: WithId<Document>): Document => {
		const { _id, ...data } = document;
		const parsed = schema.parse(data);

		return {
			...parsed,
			_id,
		} as Document;
	};

	const parseMany = (
		documents: WithId<Document>[],
	): Document[] => documents.map(parse);

	/**
	 * Validate before writing. Zod defaults and transforms are applied
	 * to the document that will be persisted.
	 */
	const validateForInsert = (
		data: OptionalUnlessRequiredId<Document>,
	): OptionalUnlessRequiredId<Document> => {
		return schema.parse(data) as OptionalUnlessRequiredId<Document>;
	};

	/**
	 * Validate simple $set updates against the complete resulting document.
	 * Other update operators need their own update validation strategy.
	 */
	const validateSetUpdate = async (
		filter: Filter<Document>,
		update: UpdateFilter<Document>,
	): Promise<UpdateFilter<Document>> => {
		const operators = Object.keys(update).filter((key) =>
			key.startsWith("$"),
		);

		if (
			operators.length !== 1 ||
			operators[0] !== "$set" ||
			!update.$set
		) {
			return update;
		}

		const existing = await mongoCollection.findOne(filter);

		if (!existing) {
			return update;
		}

		const { _id, ...current } = existing;

		const candidate = {
			...current,
			...update.$set,
		};

		schema.parse(candidate);

		return update;
	};

	return {
		// FIND

		all: async ({
			limit = 10,
			sortBy = defaultSortBy,
			order = -1,
		}: CollectionLimit<T> = {}) => {
			const results = await mongoCollection
				.find({})
				.sort({ [sortBy]: order } satisfies Sort)
				.limit(limit)
				.toArray();

			return parseMany(results);
		},

		collection: async ({
			query = "",
			limit = 10,
			sortBy = defaultSortBy,
			order = -1,
		}: CollectionLimit<T> = {}) => {
			const results = await mongoCollection
				.find({
					[searchField]: {
						$regex: query,
						$options: "i",
					},
				} as Filter<Document>)
				.sort({ [sortBy]: order } satisfies Sort)
				.limit(limit)
				.toArray();

			return parseMany(results);
		},

		find: async <K extends keyof Document & string>(
			field: K | Filter<Document>,
			filter?: Filter<Document>[K],
			{
				limit = 10,
				sortBy = defaultSortBy,
				order = -1,
			}: CollectionLimit<Document> = {},
		) => {
			const query: Filter<Document> =
				typeof field === "object"
					? field
					: ({ [field]: filter } as Filter<Document>);

			const results = await mongoCollection
				.find(query)
				.sort({ [sortBy]: order } satisfies Sort)
				.limit(limit)
				.toArray();

			return parseMany(results);
		},

		findOne: async <K extends keyof Document & string>(
			field: K | Filter<Document>,
			value?:
				| Document[K]
				| FilterOperators<Document[K]>,
			options?: FindOptions,
		): Promise<Document | null> => {
			const query: Filter<Document> =
				typeof field === "object"
					? field
					: ({ [field]: value } as Filter<Document>);

			const result = await mongoCollection.findOne(
				query,
				options,
			);

			return result
				? parse(result as WithId<Document>)
				: null;
		},

		// INSERT

		insertOne: async (
			data: OptionalUnlessRequiredId<Document>,
			options?: Parameters<
				typeof mongoCollection.insertOne
			>[1],
		): Promise<InsertOneResult<Document>> => {
			const validated = validateForInsert(data);

			return mongoCollection.insertOne(validated, options);
		},

		insertMany: async (
			data: OptionalUnlessRequiredId<Document>[],
			options?: Parameters<
				typeof mongoCollection.insertMany
			>[1],
		): Promise<InsertManyResult<Document>> => {
			const validated = data.map(validateForInsert);

			return mongoCollection.insertMany(validated, options);
		},

		create: async (
			data: OptionalUnlessRequiredId<Document>,
		): Promise<Document> => {
			const now = new Date();

			const document = validateForInsert({
				...data,
				created_at: now,
				updated_at: now,
			} as OptionalUnlessRequiredId<Document>);

			const result = await mongoCollection.insertOne(document);

			return {
				...document,
				_id: result.insertedId,
			} as Document;
		},

		// UPDATE

		updateOne: async (
			filter: Filter<Document>,
			update: UpdateFilter<Document>,
			options?: UpdateOptions,
		) => {
			const validatedUpdate = await validateSetUpdate(
				filter,
				update,
			);

			return mongoCollection.updateOne(
				filter,
				validatedUpdate,
				options,
			);
		},

		updateMany: async (
			filter: Filter<Document>,
			update: UpdateFilter<Document>,
			options?: UpdateOptions,
		) => {
			// Full-document validation for multi-document updates requires
			// validating each resulting document before applying changes.
			return mongoCollection.updateMany(
				filter,
				update,
				options,
			);
		},

		findOneAndUpdate: async (
			filter: Filter<Document>,
			update: UpdateFilter<Document>,
			options?: FindOneAndUpdateOptions,
		): Promise<Document | null> => {
			const validatedUpdate = await validateSetUpdate(
				filter,
				update,
			);

			const result = await mongoCollection.findOneAndUpdate(
				filter,
				validatedUpdate,
				{
					returnDocument: "after",
					...options,
				},
			);

			return result ? parse(result) : null;
		},

		// DELETE

		deleteOne: async (
			filter: Filter<Document>,
			options?: DeleteOptions,
		) => mongoCollection.deleteOne(filter, options),

		deleteMany: async (
			filter: Filter<Document>,
			options?: DeleteOptions,
		) => mongoCollection.deleteMany(filter, options),

		// COUNT

		countDocuments: async (
			filter: Filter<Document> = {},
			options?: Parameters<
				typeof mongoCollection.countDocuments
			>[1],
		) => mongoCollection.countDocuments(filter, options),

		estimatedDocumentCount: async (
			options?: Parameters<
				typeof mongoCollection.estimatedDocumentCount
			>[0],
		) => mongoCollection.estimatedDocumentCount(options),

		// EXISTS

		exists: async (filter: Filter<Document>) =>
			(await mongoCollection.countDocuments(filter, {
				limit: 1,
			})) > 0,
	};
};
