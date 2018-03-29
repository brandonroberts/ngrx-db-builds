import { Observable, Subject } from 'rxjs';
import { InjectionToken, ModuleWithProviders } from '@angular/core';
export declare const DB_INSERT = "DB_INSERT";
export declare const DatabaseBackend: InjectionToken<{}>;
export declare const IDB_SCHEMA: InjectionToken<{}>;
export interface DBUpgradeHandler {
    (db: IDBDatabase): void;
}
export interface DBStore {
    primaryKey?: string;
    autoIncrement?: boolean;
}
export interface DBSchema {
    version: number;
    name: string;
    stores: {
        [storename: string]: DBStore;
    };
}
export declare function getIDBFactory(): IDBFactory;
export declare class Database {
    changes: Subject<any>;
    private _idb;
    private _schema;
    constructor(idbBackend: any, schema: any);
    private _mapRecord(objectSchema);
    private _upgradeDB(observer, db);
    private _createObjectStore(db, key, schema);
    open(dbName: string, version?: number, upgradeHandler?: DBUpgradeHandler): Observable<IDBDatabase>;
    deleteDatabase(dbName: string): Observable<any>;
    insert(storeName: string, records: any[], notify?: boolean): Observable<any>;
    get(storeName: string, key: any): Observable<any>;
    query(storeName: string, predicate?: (rec: any) => boolean): Observable<any>;
    executeWrite(storeName: string, actionType: string, records: any[]): Observable<any>;
    compare(a: any, b: any): number;
}
export declare class DBModule {
    static provideDB(schema: DBSchema): ModuleWithProviders;
}
