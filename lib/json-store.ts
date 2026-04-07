import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { normalizeStoredBoardJobKey } from '@/lib/board-job-dedupe';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

export interface JsonUser {
  id: string;
  email: string;
  name: string | null;
  password: string;
  createdAt: string;
  updatedAt: string;
}

export interface JsonApplicationTemplate {
  id: string;
  userId: string;
  resumePath: string | null;
  resumeFileName: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  coverLetter: string | null;
  workAuthStatus: string | null;
  yearsExperience: number | null;
  currentLocation: string | null;
  additionalFields: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JsonApplicationHistory {
  id: string;
  userId: string;
  jobTitle: string;
  companyName: string;
  jobUrl: string;
  location: string | null;
  department: string | null;
  status: string;
  errorMessage: string | null;
  appliedAt: string;
  applicationData: unknown | null;
}

/** Aggregated Greenhouse listings for Auto Search (refreshed by cron) */
export interface CachedJobRow {
  boardId: string;
  boardToken: string;
  boardDisplayName: string;
  category: string;
  companyName: string;
  jobId: number;
  title: string;
  location: string | null;
  department: string | null;
  jobUrl: string;
  /** ISO time this posting was first seen by Auto Search (never moves forward on rescrape) */
  firstFoundAt: string;
}

export interface JobFeedCache {
  updatedAt: string;
  boardsScanned: number;
  boardsFailed: number;
  boardErrors: { boardId: string; message: string }[];
  jobs: CachedJobRow[];
  /**
   * Stable key `boardToken:jobId` -> ISO first-seen (persists if job drops off board and returns).
   */
  firstSeenByJobKey: Record<string, string>;
}

/** Auto pilot / watch: preset boards + filters, dedupe by boardToken:jobId */
export interface WatchConfig {
  userId: string;
  enabled: boolean;
  /** Preset board ids e.g. wppmedia, capco */
  selectedBoardIds: string[];
  keywords: string;
  location: string;
  department: string;
  appliedJobKeys: string[];
  lastRunAt: string | null;
  lastRunSummary: string | null;
  updatedAt: string;
}

interface Store {
  users: JsonUser[];
  templates: JsonApplicationTemplate[];
  applicationHistory: JsonApplicationHistory[];
  watchConfigs: WatchConfig[];
  jobFeedCache: JobFeedCache | null;
}

function readStoreSync(): Store {
  if (!fs.existsSync(STORE_FILE)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const empty: Store = {
      users: [],
      templates: [],
      applicationHistory: [],
      watchConfigs: [],
      jobFeedCache: null,
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(empty, null, 2), 'utf-8');
    return empty;
  }
  const raw = fs.readFileSync(STORE_FILE, 'utf-8');
  const parsed = JSON.parse(raw) as Store;
  if (!parsed.watchConfigs) parsed.watchConfigs = [];
  if (parsed.jobFeedCache === undefined) parsed.jobFeedCache = null;
  if (parsed.jobFeedCache) {
    const c = parsed.jobFeedCache;
    if (!c.firstSeenByJobKey) c.firstSeenByJobKey = {};
    const map = c.firstSeenByJobKey;
    if (c.jobs) {
      for (const j of c.jobs) {
        const k = `${j.boardToken}:${j.jobId}`;
        if (!j.firstFoundAt) {
          j.firstFoundAt = map[k] ?? c.updatedAt ?? new Date().toISOString();
        }
        if (!map[k]) map[k] = j.firstFoundAt;
      }
    }
  }
  return parsed;
}

function writeStoreSync(store: Store): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

let writeChain: Promise<void> = Promise.resolve();

function queueWrite<T>(fn: () => T): Promise<T> {
  const run = (): Promise<T> =>
    new Promise((resolve, reject) => {
      try {
        resolve(fn());
      } catch (e) {
        reject(e);
      }
    });
  const p = writeChain.then(() => run());
  writeChain = p.then(
    () => {},
    () => {}
  );
  return p;
}

export async function findUserByEmail(
  email: string
): Promise<JsonUser | undefined> {
  const store = readStoreSync();
  return store.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export async function findUserById(id: string): Promise<JsonUser | undefined> {
  const store = readStoreSync();
  return store.users.find((u) => u.id === id);
}

export async function createUser(data: {
  email: string;
  password: string;
  name: string | null;
}): Promise<JsonUser> {
  return queueWrite(() => {
    const store = readStoreSync();
    if (
      store.users.some(
        (u) => u.email.toLowerCase() === data.email.toLowerCase()
      )
    ) {
      throw new Error('User already exists');
    }
    const now = new Date().toISOString();
    const user: JsonUser = {
      id: randomUUID(),
      email: data.email,
      name: data.name,
      password: data.password,
      createdAt: now,
      updatedAt: now,
    };
    store.users.push(user);
    writeStoreSync(store);
    return user;
  });
}

export async function getActiveTemplate(
  userId: string
): Promise<JsonApplicationTemplate | null> {
  const store = readStoreSync();
  const active = store.templates.filter(
    (t) => t.userId === userId && t.isActive
  );
  active.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  return active[0] ?? null;
}

export async function deactivateTemplatesForUser(userId: string): Promise<void> {
  return queueWrite(() => {
    const store = readStoreSync();
    for (const t of store.templates) {
      if (t.userId === userId && t.isActive) {
        t.isActive = false;
        t.updatedAt = new Date().toISOString();
      }
    }
    writeStoreSync(store);
  });
}

export async function createTemplate(data: {
  userId: string;
  resumePath: string | null;
  resumeFileName: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  coverLetter: string | null;
  workAuthStatus: string | null;
  yearsExperience: number | null;
  currentLocation: string | null;
  additionalFields: Record<string, unknown> | null;
}): Promise<JsonApplicationTemplate> {
  return queueWrite(() => {
    const store = readStoreSync();
    const now = new Date().toISOString();
    const template: JsonApplicationTemplate = {
      id: randomUUID(),
      userId: data.userId,
      resumePath: data.resumePath,
      resumeFileName: data.resumeFileName,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      linkedinUrl: data.linkedinUrl,
      portfolioUrl: data.portfolioUrl,
      coverLetter: data.coverLetter,
      workAuthStatus: data.workAuthStatus,
      yearsExperience: data.yearsExperience,
      currentLocation: data.currentLocation,
      additionalFields: data.additionalFields,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    store.templates.push(template);
    writeStoreSync(store);
    return template;
  });
}

export async function createApplicationHistory(data: {
  userId: string;
  jobTitle: string;
  companyName: string;
  jobUrl: string;
  location: string | null;
  department: string | null;
  status: string;
  errorMessage: string | null;
  applicationData: unknown | null;
}): Promise<JsonApplicationHistory> {
  return queueWrite(() => {
    const store = readStoreSync();
    const row: JsonApplicationHistory = {
      id: randomUUID(),
      userId: data.userId,
      jobTitle: data.jobTitle,
      companyName: data.companyName,
      jobUrl: data.jobUrl,
      location: data.location,
      department: data.department,
      status: data.status,
      errorMessage: data.errorMessage,
      appliedAt: new Date().toISOString(),
      applicationData: data.applicationData,
    };
    store.applicationHistory.push(row);
    writeStoreSync(store);
    return row;
  });
}

export async function listApplicationHistory(
  userId: string
): Promise<JsonApplicationHistory[]> {
  const store = readStoreSync();
  const uid = String(userId);
  const rows = store.applicationHistory.filter((h) => String(h.userId) === uid);
  rows.sort(
    (a, b) =>
      new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()
  );
  return rows;
}

export async function countHistoryByUser(
  userId: string,
  status?: string
): Promise<number> {
  const store = readStoreSync();
  const uid = String(userId);
  return store.applicationHistory.filter(
    (h) =>
      String(h.userId) === uid && (status == null || h.status === status)
  ).length;
}

function defaultWatchConfig(userId: string): WatchConfig {
  const now = new Date().toISOString();
  return {
    userId,
    enabled: false,
    selectedBoardIds: [],
    keywords: '',
    location: '',
    department: '',
    appliedJobKeys: [],
    lastRunAt: null,
    lastRunSummary: null,
    updatedAt: now,
  };
}

export async function getWatchConfig(
  userId: string
): Promise<WatchConfig> {
  const store = readStoreSync();
  const found = store.watchConfigs.find((w) => w.userId === userId);
  return found ?? defaultWatchConfig(userId);
}

export async function upsertWatchConfig(
  userId: string,
  data: Partial<
    Omit<WatchConfig, 'userId' | 'appliedJobKeys' | 'lastRunAt' | 'lastRunSummary'>
  > & {
    appliedJobKeys?: string[];
    lastRunAt?: string | null;
    lastRunSummary?: string | null;
  }
): Promise<WatchConfig> {
  return queueWrite(() => {
    const store = readStoreSync();
    if (!store.watchConfigs) store.watchConfigs = [];
    const idx = store.watchConfigs.findIndex((w) => w.userId === userId);
    const now = new Date().toISOString();
    if (idx === -1) {
      const row: WatchConfig = {
        ...defaultWatchConfig(userId),
        ...data,
        userId,
        appliedJobKeys: data.appliedJobKeys ?? [],
        updatedAt: now,
      };
      store.watchConfigs.push(row);
      writeStoreSync(store);
      return row;
    }
    const prev = store.watchConfigs[idx];
    const next: WatchConfig = {
      ...prev,
      ...data,
      userId,
      appliedJobKeys:
        data.appliedJobKeys !== undefined ? data.appliedJobKeys : prev.appliedJobKeys,
      lastRunAt:
        data.lastRunAt !== undefined ? data.lastRunAt : prev.lastRunAt,
      lastRunSummary:
        data.lastRunSummary !== undefined
          ? data.lastRunSummary
          : prev.lastRunSummary,
      updatedAt: now,
    };
    store.watchConfigs[idx] = next;
    writeStoreSync(store);
    return next;
  });
}

export async function mergeAppliedJobKeys(
  userId: string,
  newKeys: string[]
): Promise<void> {
  if (newKeys.length === 0) return;
  return queueWrite(() => {
    const store = readStoreSync();
    if (!store.watchConfigs) store.watchConfigs = [];
    const idx = store.watchConfigs.findIndex((w) => w.userId === userId);
    const set = new Set<string>();
    if (idx >= 0) {
      for (const k of store.watchConfigs[idx].appliedJobKeys) {
        set.add(normalizeStoredBoardJobKey(k));
      }
    }
    for (const k of newKeys) set.add(normalizeStoredBoardJobKey(k));
    const merged = Array.from(set);
    if (idx === -1) {
      store.watchConfigs.push({
        ...defaultWatchConfig(userId),
        appliedJobKeys: merged,
        updatedAt: new Date().toISOString(),
      });
    } else {
      store.watchConfigs[idx].appliedJobKeys = merged;
      store.watchConfigs[idx].updatedAt = new Date().toISOString();
    }
    writeStoreSync(store);
  });
}

export async function listEnabledWatchConfigs(): Promise<WatchConfig[]> {
  const store = readStoreSync();
  if (!store.watchConfigs) return [];
  return store.watchConfigs.filter((w) => w.enabled);
}

export function getJobFeedCacheSync(): JobFeedCache | null {
  const store = readStoreSync();
  return store.jobFeedCache ?? null;
}

export async function setJobFeedCache(cache: JobFeedCache): Promise<void> {
  return queueWrite(() => {
    const store = readStoreSync();
    store.jobFeedCache = cache;
    writeStoreSync(store);
  });
}
