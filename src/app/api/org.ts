import * as api from './api';
import { Org } from 'app/models/organization';
import { createStore, useStore } from 'app/state/store';

const proponents = createStore<Org[]>([]);

export function setValue(value: Org[] | null): void {
  proponents.set(value || []);
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

  setValue(await api.getOrgsByCompanyType('Proponent/Certificate Holder'));
}
