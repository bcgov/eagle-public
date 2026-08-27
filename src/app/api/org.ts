import * as api from './api';
import { Org } from 'app/models/organization';
import { createStore, useStore } from 'app/state/store';
import { startLoading, stopLoading } from 'app/state/loading-state';

const proponents = createStore<Org[]>([]);

export async function getByCompanyType(type: string): Promise<Org[]> {
  const loadingId = `org-${type}`;
  startLoading(loadingId, `Loading ${type} organizations`);
  try {
    const res = await api.getOrgsByCompanyType(type);
    return res ? res.map((org: any) => new Org(org)) : [];
  } finally {
    stopLoading(loadingId);
  }
}

export function setValue(value: Org[] | null): void {
  proponents.set(value || []);
}

export function getValue(): Org[] {
  return proponents.get();
}

export function useProponents(): Org[] {
  return useStore(proponents);
}

export function clearValue(): void {
  setValue(null);
}

export async function fetchProponent(): Promise<void> {
  // Only fetch if data hasn't been loaded yet
  if (proponents.get().length > 0) {
    return;
  }

  const loadingId = 'org-proponent';
  startLoading(loadingId, 'Loading proponent organizations');
  try {
    setValue(await api.getOrgsByCompanyType('Proponent/Certificate Holder'));
  } finally {
    stopLoading(loadingId);
  }
}
