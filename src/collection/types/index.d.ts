import type {
	CountDocumentsOptions,
	DeleteOptions,
	Db,
	DeleteResult,
	Filter,
	FilterOperators,
	FindOptions,
	FindOneAndUpdateOptions,
	InsertManyResult,
	InsertOneResult,
	OptionalUnlessRequiredId,
	UpdateFilter,
	UpdateOptions,
	UpdateResult,
} from "mongodb";

// -------------------------
// DOCUMENT
// -------------------------

export type CollectionDocument<
	T extends Record<string, unknown>,
> = T & {
	_id?: T extends { _id: infer ID } ? ID : unknown;
};

// -------------------------
// LIMIT / SORT
// -------------------------

export type CollectionLimit<T> = {
	limit?: number;
	sortBy?: keyof T & string;
	order?: 1 | -1;
	query?: string;
};

// -------------------------
// CONFIG
// -------------------------

export type CollectionConfig<
	T extends Record<string, unknown>,
> = {
	name: string;
	searchField?: keyof T & string;
	defaultSortBy?: keyof T & string;
};

// -------------------------
// SERVICE
// -------------------------

export type CollectionService<
	T extends Record<string, unknown>,
> = {
	// -------------------------
	// FIND
	// -------------------------

	all: (
		options?: CollectionLimit<T>,
	) => Promise<CollectionDocument<T>[]>;

	collection: (
		options?: CollectionLimit<T>,
	) => Promise<CollectionDocument<T>[]>;

	find: <K extends keyof CollectionDocument<T> & string>(
		field: K | Filter<CollectionDocument<T>>,
		filter?: Filter<CollectionDocument<T>>[K],
		options?: CollectionLimit<CollectionDocument<T>>,
	) => Promise<CollectionDocument<T>[]>;

	findOne: <
		K extends keyof CollectionDocument<T> & string,
	>(
		field: K | Filter<CollectionDocument<T>>,
		value?:
			| CollectionDocument<T>[K]
			| FilterOperators<CollectionDocument<T>[K]>,
		options?: FindOptions<CollectionDocument<T>>,
	) => Promise<CollectionDocument<T> | null>;

	// -------------------------
	// INSERT
	// -------------------------

	insertOne: (
		data: OptionalUnlessRequiredId<
			CollectionDocument<T>
		>,
		options?: Parameters<
			Db["collection"]
		>[1],
	) => Promise<
		InsertOneResult<CollectionDocument<T>>
	>;

	insertMany: (
		data: OptionalUnlessRequiredId<
			CollectionDocument<T>
		>[],
		options?: Parameters<
			Db["collection"]
		>[1],
	) => Promise<
		InsertManyResult<CollectionDocument<T>>
	>;

	create: (
		data: OptionalUnlessRequiredId<
			CollectionDocument<T>
		>,
	) => Promise<CollectionDocument<T>>;

	// -------------------------
	// UPDATE
	// -------------------------

	updateOne: (
		filter: Filter<CollectionDocument<T>>,
		update: UpdateFilter<CollectionDocument<T>>,
		options?: UpdateOptions,
	) => Promise<UpdateResult>;

	updateMany: (
		filter: Filter<CollectionDocument<T>>,
		update: UpdateFilter<CollectionDocument<T>>,
		options?: UpdateOptions,
	) => Promise<UpdateResult>;

	findOneAndUpdate: (
		filter: Filter<CollectionDocument<T>>,
		update: UpdateFilter<CollectionDocument<T>>,
		options?: FindOneAndUpdateOptions,
	) => Promise<CollectionDocument<T> | null>;

	// -------------------------
	// DELETE
	// -------------------------

	deleteOne: (
		filter: Filter<CollectionDocument<T>>,
		options?: DeleteOptions,
	) => Promise<DeleteResult>;

	deleteMany: (
		filter: Filter<CollectionDocument<T>>,
		options?: DeleteOptions,
	) => Promise<DeleteResult>;

	// -------------------------
	// COUNT
	// -------------------------

	countDocuments: (
		filter?: Filter<CollectionDocument<T>>,
		options?: CountDocumentsOptions,
	) => Promise<number>;

	estimatedDocumentCount: (
		options?: Parameters<
			Db["collection"]
		>[1],
	) => Promise<number>;

	// -------------------------
	// EXISTS
	// -------------------------

	exists: (
		filter: Filter<CollectionDocument<T>>,
	) => Promise<boolean>;
};

// -------------------------
// FACTORY
// -------------------------

export type CreateServiceFn = (
	db: Db,
) => <T extends Record<string, unknown>>(
	config: CollectionConfig<T>,
) => CollectionService<T>;