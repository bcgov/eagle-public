import * as api from './api';
import * as documentApi from './document';
import { Decision } from 'app/models/decision';
import { startLoading, stopLoading } from 'app/state/loading-state';

let cachedDecision: Decision | null = null;

async function withDocuments(decisions: Decision[], loadingId: string): Promise<Decision> {
  // return the first (only) decision
  const decision = decisions.length > 0 ? new Decision(decisions[0]) : null;
  if (!decision) {
    stopLoading(loadingId);
    return null as unknown as Decision;
  }

  decision.documents = await documentApi.getAllByDecisionId(decision._id) || [];
  cachedDecision = decision;
  stopLoading(loadingId);
  return decision;
}

export async function getByApplicationId(appId: string, forceReload = false): Promise<Decision> {
  if (cachedDecision && cachedDecision._application === appId && !forceReload) {
    return cachedDecision;
  }

  const loadingId = `decision-app-${appId}`;
  startLoading(loadingId, 'Loading decision');
  try {
    return await withDocuments(await api.getDecisionByAppId(appId), loadingId);
  } catch (error) {
    stopLoading(loadingId);
    throw error;
  }
}

export async function getById(decisionId: string, forceReload = false): Promise<Decision> {
  if (cachedDecision && cachedDecision._id === decisionId && !forceReload) {
    return cachedDecision;
  }

  const loadingId = `decision-${decisionId}`;
  startLoading(loadingId, 'Loading decision');
  try {
    return await withDocuments(await api.getDecision(decisionId), loadingId);
  } catch (error) {
    stopLoading(loadingId);
    throw error;
  }
}
