import { Observable, Subject, from } from 'rxjs';
import { mergeMap, tap } from 'rxjs/operators';
import { InjectionToken, Inject, Injectable, NgModule, } from '@angular/core';
var IDB_SUCCESS = 'success';
var IDB_COMPLETE = 'complete';
var IDB_ERROR = 'error';
var IDB_UPGRADE_NEEDED = 'upgradeneeded';
var IDB_TXN_READ = 'readonly';
var IDB_TXN_READWRITE = 'readwrite';
export var DB_INSERT = 'DB_INSERT';
export var DatabaseBackend = new InjectionToken('IndexedDBBackend');
export var IDB_SCHEMA = new InjectionToken('IDB_SCHEMA');
export function getIDBFactory() {
    return typeof window !== 'undefined' ? window.indexedDB : self.indexedDB;
}
var Database = /** @class */ (function () {
    function Database(idbBackend, schema) {
        this.changes = new Subject();
        this._schema = schema;
        this._idb = idbBackend;
    }
    Database.prototype._mapRecord = function (objectSchema) {
        return function (dbResponseRec) {
            if (!objectSchema.primaryKey) {
                dbResponseRec.record['$key'] = dbResponseRec['$key'];
            }
            return dbResponseRec.record;
        };
    };
    Database.prototype._upgradeDB = function (observer, db) {
        for (var storeName in this._schema.stores) {
            if (db.objectStoreNames.contains(storeName)) {
                db.deleteObjectStore(storeName);
            }
            this._createObjectStore(db, storeName, this._schema.stores[storeName]);
        }
        observer.next(db);
        observer.complete();
    };
    Database.prototype._createObjectStore = function (db, key, schema) {
        var objectStore = db.createObjectStore(key, {
            autoIncrement: true,
            keyPath: schema.primaryKey,
        });
    };
    Database.prototype.open = function (dbName, version, upgradeHandler) {
        var _this = this;
        if (version === void 0) { version = 1; }
        var idb = this._idb;
        return Observable.create(function (observer) {
            var openReq = idb.open(dbName, _this._schema.version);
            var onSuccess = function (event) {
                observer.next(event.target.result);
                observer.complete();
            };
            var onError = function (err) {
                console.log(err);
                observer.error(err);
            };
            var onUpgradeNeeded = function (event) {
                _this._upgradeDB(observer, event.target.result);
            };
            openReq.addEventListener(IDB_SUCCESS, onSuccess);
            openReq.addEventListener(IDB_ERROR, onError);
            openReq.addEventListener(IDB_UPGRADE_NEEDED, onUpgradeNeeded);
            return function () {
                openReq.removeEventListener(IDB_SUCCESS, onSuccess);
                openReq.removeEventListener(IDB_ERROR, onError);
                openReq.removeEventListener(IDB_UPGRADE_NEEDED, onUpgradeNeeded);
            };
        });
    };
    Database.prototype.deleteDatabase = function (dbName) {
        var _this = this;
        return new Observable(function (deletionObserver) {
            var deleteRequest = _this._idb.deleteDatabase(dbName);
            var onSuccess = function (event) {
                deletionObserver.next(null);
                deletionObserver.complete();
            };
            var onError = function (err) { return deletionObserver.error(err); };
            deleteRequest.addEventListener(IDB_SUCCESS, onSuccess);
            deleteRequest.addEventListener(IDB_ERROR, onError);
            return function () {
                deleteRequest.removeEventListener(IDB_SUCCESS, onSuccess);
                deleteRequest.removeEventListener(IDB_ERROR, onError);
            };
        });
    };
    Database.prototype.insert = function (storeName, records, notify) {
        var _this = this;
        if (notify === void 0) { notify = true; }
        var write$ = this.executeWrite(storeName, 'put', records);
        return write$.pipe(tap(function (payload) {
            return notify ? _this.changes.next({ type: DB_INSERT, payload: payload }) : {};
        }));
    };
    Database.prototype.get = function (storeName, key) {
        var _this = this;
        var open$ = this.open(this._schema.name);
        return open$.pipe(mergeMap(function (db) {
            return new Observable(function (txnObserver) {
                var recordSchema = _this._schema.stores[storeName];
                var mapper = _this._mapRecord(recordSchema);
                var txn = db.transaction([storeName], IDB_TXN_READ);
                var objectStore = txn.objectStore(storeName);
                var getRequest = objectStore.get(key);
                var onTxnError = function (err) { return txnObserver.error(err); };
                var onTxnComplete = function () { return txnObserver.complete(); };
                var onRecordFound = function (ev) {
                    return txnObserver.next(getRequest.result);
                };
                txn.addEventListener(IDB_COMPLETE, onTxnComplete);
                txn.addEventListener(IDB_ERROR, onTxnError);
                getRequest.addEventListener(IDB_SUCCESS, onRecordFound);
                getRequest.addEventListener(IDB_ERROR, onTxnError);
                return function () {
                    getRequest.removeEventListener(IDB_SUCCESS, onRecordFound);
                    getRequest.removeEventListener(IDB_ERROR, onTxnError);
                    txn.removeEventListener(IDB_COMPLETE, onTxnComplete);
                    txn.removeEventListener(IDB_ERROR, onTxnError);
                };
            });
        }));
    };
    Database.prototype.query = function (storeName, predicate) {
        var open$ = this.open(this._schema.name);
        return open$.pipe(mergeMap(function (db) {
            return new Observable(function (txnObserver) {
                var txn = db.transaction([storeName], IDB_TXN_READ);
                var objectStore = txn.objectStore(storeName);
                var getRequest = objectStore.openCursor();
                var onTxnError = function (err) { return txnObserver.error(err); };
                var onRecordFound = function (ev) {
                    var cursor = ev.target.result;
                    if (cursor) {
                        if (predicate) {
                            var match = predicate(cursor.value);
                            if (match) {
                                txnObserver.next(cursor.value);
                            }
                        }
                        else {
                            txnObserver.next(cursor.value);
                        }
                        cursor.continue();
                    }
                    else {
                        txnObserver.complete();
                    }
                };
                txn.addEventListener(IDB_ERROR, onTxnError);
                getRequest.addEventListener(IDB_SUCCESS, onRecordFound);
                getRequest.addEventListener(IDB_ERROR, onTxnError);
                return function () {
                    getRequest.removeEventListener(IDB_SUCCESS, onRecordFound);
                    getRequest.removeEventListener(IDB_ERROR, onTxnError);
                    txn.removeEventListener(IDB_ERROR, onTxnError);
                };
            });
        }));
    };
    Database.prototype.executeWrite = function (storeName, actionType, records) {
        var _this = this;
        var changes = this.changes;
        var open$ = this.open(this._schema.name);
        return open$.pipe(mergeMap(function (db) {
            return new Observable(function (txnObserver) {
                var recordSchema = _this._schema.stores[storeName];
                var mapper = _this._mapRecord(recordSchema);
                var txn = db.transaction([storeName], IDB_TXN_READWRITE);
                var objectStore = txn.objectStore(storeName);
                var onTxnError = function (err) { return txnObserver.error(err); };
                var onTxnComplete = function () { return txnObserver.complete(); };
                txn.addEventListener(IDB_COMPLETE, onTxnComplete);
                txn.addEventListener(IDB_ERROR, onTxnError);
                var makeRequest = function (record) {
                    return new Observable(function (reqObserver) {
                        var req;
                        if (recordSchema.primaryKey) {
                            req = objectStore[actionType](record);
                        }
                        else {
                            var $key = record['$key'];
                            var $record = Object.assign({}, record);
                            delete $record.key;
                            req = objectStore[actionType]($record, $key);
                        }
                        req.addEventListener(IDB_SUCCESS, function () {
                            var $key = req.result;
                            reqObserver.next(mapper({ $key: $key, record: record }));
                        });
                        req.addEventListener(IDB_ERROR, function (err) {
                            reqObserver.error(err);
                        });
                    });
                };
                var requestSubscriber = from(records)
                    .pipe(mergeMap(makeRequest))
                    .subscribe(txnObserver);
                return function () {
                    requestSubscriber.unsubscribe();
                    txn.removeEventListener(IDB_COMPLETE, onTxnComplete);
                    txn.removeEventListener(IDB_ERROR, onTxnError);
                };
            });
        }));
    };
    Database.prototype.compare = function (a, b) {
        return this._idb.cmp(a, b);
    };
    Database.decorators = [
        { type: Injectable },
    ];
    /** @nocollapse */
    Database.ctorParameters = function () { return [
        { type: undefined, decorators: [{ type: Inject, args: [DatabaseBackend,] },] },
        { type: undefined, decorators: [{ type: Inject, args: [IDB_SCHEMA,] },] },
    ]; };
    return Database;
}());
export { Database };
var DBModule = /** @class */ (function () {
    function DBModule() {
    }
    DBModule.provideDB = function (schema) {
        return {
            ngModule: DBModule,
            providers: [{ provide: IDB_SCHEMA, useValue: schema }],
        };
    };
    DBModule.decorators = [
        { type: NgModule, args: [{
                    providers: [
                        Database,
                        { provide: DatabaseBackend, useFactory: getIDBFactory },
                    ],
                },] },
    ];
    /** @nocollapse */
    DBModule.ctorParameters = function () { return []; };
    return DBModule;
}());
export { DBModule };
//# sourceMappingURL=database.js.map