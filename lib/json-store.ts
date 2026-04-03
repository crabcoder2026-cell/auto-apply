import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

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

interface Store {
  users: JsonUser[];
  templates: JsonApplicationTemplate[];
  applicationHistory: JsonApplicationHistory[];
}

function readStoreSync(): Store {
  if (!fs.existsSync(STORE_FILE)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const empty: Store = {
      users: [],
      templates: [],
      applicationHistory: [],
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(empty, null, 2), 'utf-8');
    return empty;
  }
  const raw = fs.readFileSync(STORE_FILE, 'utf-8');
  return JSON.parse(raw) as Store;
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
  const rows = store.applicationHistory.filter((h) => h.userId === userId);
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
  return store.applicationHistory.filter(
    (h) => h.userId === userId && (status == null || h.status === status)
  ).length;
}
