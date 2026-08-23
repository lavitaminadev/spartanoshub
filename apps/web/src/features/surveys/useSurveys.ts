/**
 * @fileoverview Capa de datos de Encuestas: TanStack Query sobre la API, con una copia local
 * que sostiene la feature cuando el backend no está disponible.
 *
 * El respaldo local no es solo caché de lectura: las mutaciones escriben en `localStorage` de
 * inmediato y solo esperan la API cuando hay red. Sin esto, en modo visual (`npm run
 * dev:visual`, ver `src/dev/visual-mode.ts`) cada `POST /surveys` respondería un 200 vacío que
 * no persiste nada, y el asistente de creación parecería funcionar sin dejar ninguna encuesta
 * creada en la lista. El respaldo solo entra cuando el fallo es de conexión (`ApiError` sin
 * `status`); un rechazo del servidor con status —validación, permisos— se propaga tal cual para
 * que el formulario lo muestre.
 */

import { useMutation, useQuery, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { api, ApiError } from '../../core/api';
import { readStoredJson, storageKey, writeStoredJson } from '../../core/browser-storage';
import type { Survey, SurveyQuestion, SurveyResponse, SurveyResultsSummary, SurveyType } from '@espartanos/shared';
import { computeSurveyResults } from '@espartanos/shared';

const LIST_KEY = storageKey('surveys', 'list');
const responsesKey = (surveyId: string) => storageKey('surveys', 'responses', surveyId);

/** Indica si un error de `api` corresponde a que no hubo red, no a un rechazo del servidor. */
function isConnectionError(error: unknown): boolean {
  return error instanceof ApiError && error.status === undefined;
}

function readLocalSurveys(): Survey[] {
  return readStoredJson<Survey[]>(LIST_KEY, []);
}

function writeLocalSurveys(surveys: Survey[]): void {
  writeStoredJson(LIST_KEY, surveys);
}

function readLocalResponses(surveyId: string): SurveyResponse[] {
  return readStoredJson<SurveyResponse[]>(responsesKey(surveyId), []);
}

function writeLocalResponses(surveyId: string, responses: SurveyResponse[]): void {
  writeStoredJson(responsesKey(surveyId), responses);
}

/**
 * Combina lo que devolvió el servidor con lo que solo existe localmente.
 *
 * El servidor manda sobre cualquier encuesta que conozca; las que existen solo en el
 * dispositivo (creadas sin red) se conservan al final, en vez de perderse en el primer
 * refetch exitoso.
 */
function mergeWithLocal(serverSurveys: Survey[]): Survey[] {
  const local = readLocalSurveys();
  const serverIds = new Set(serverSurveys.map((survey) => survey.id));
  const localOnly = local.filter((survey) => !serverIds.has(survey.id));
  const merged = [...serverSurveys, ...localOnly];
  writeLocalSurveys(merged);
  return merged;
}

function normalizeListResponse(payload: unknown): Survey[] {
  if (Array.isArray(payload)) return payload as Survey[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: Survey[] }).data;
  }
  return [];
}

/** Lista todas las encuestas visibles para el usuario actual. */
export function useSurveys() {
  return useQuery<Survey[]>({
    queryKey: ['surveys'],
    queryFn: async () => {
      try {
        const payload = await api.get<unknown>('/surveys');
        return mergeWithLocal(normalizeListResponse(payload));
      } catch (error) {
        if (isConnectionError(error)) return readLocalSurveys();
        throw error;
      }
    },
  });
}

/** Lee una encuesta puntual, cayendo a la copia local del listado si no hay red. */
export function useSurvey(id: string | undefined) {
  return useQuery<Survey | undefined>({
    queryKey: ['surveys', id],
    enabled: Boolean(id),
    queryFn: async () => {
      try {
        return await api.get<Survey>(`/surveys/${id}`);
      } catch (error) {
        if (isConnectionError(error)) return readLocalSurveys().find((survey) => survey.id === id);
        throw error;
      }
    },
  });
}

/** Payload para crear una encuesta. El backend asigna `id`, `createdAt` y arranca en `draft`. */
export interface CreateSurveyInput {
  title: string;
  type: SurveyType;
  clientId?: string;
  /** Solo sostiene el borrador local si se crea sin conexión; el servidor fija la autoría real. */
  createdBy?: string;
  questions: SurveyQuestion[];
  recipients?: string[];
  distribution?: Survey['distribution'];
  ga4MeasurementId?: string | null;
  designConfig?: Survey['designConfig'];
  googleReview?: Survey['googleReview'];
}

function buildLocalSurvey(input: CreateSurveyInput): Survey {
  return {
    id: crypto.randomUUID(),
    title: input.title,
    type: input.type,
    questions: input.questions,
    status: 'draft',
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy ?? 'Usuario local',
    recipients: input.recipients,
    distribution: input.distribution,
    ga4MeasurementId: input.ga4MeasurementId,
    responses: 0,
    designConfig: input.designConfig,
    googleReview: input.googleReview,
  };
}

/** Crea una encuesta. Devuelve la encuesta creada, venga de la API o de la copia local. */
export function useCreateSurvey(): UseMutationResult<Survey, Error, CreateSurveyInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input) => {
      try {
        const created = await api.post<Survey, CreateSurveyInput>('/surveys', input);
        writeLocalSurveys([...readLocalSurveys(), created]);
        return created;
      } catch (error) {
        if (!isConnectionError(error)) throw error;
        const created = buildLocalSurvey(input);
        writeLocalSurveys([...readLocalSurveys(), created]);
        return created;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['surveys'] }),
  });
}

/** Actualiza campos de una encuesta existente (preguntas, estado, distribución, título). */
export function useUpdateSurvey(): UseMutationResult<Survey, Error, { id: string; patch: Partial<Survey> }> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }) => {
      const applyLocally = () => {
        const next = readLocalSurveys().map((survey) => (survey.id === id ? { ...survey, ...patch } : survey));
        writeLocalSurveys(next);
        return next.find((survey) => survey.id === id) as Survey;
      };
      try {
        const updated = await api.put<Survey, Partial<Survey>>(`/surveys/${id}`, patch);
        const next = readLocalSurveys().map((survey) => (survey.id === id ? updated : survey));
        writeLocalSurveys(next);
        return updated;
      } catch (error) {
        if (!isConnectionError(error)) throw error;
        return applyLocally();
      }
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
      queryClient.invalidateQueries({ queryKey: ['surveys', updated.id] });
    },
  });
}

/** Elimina una encuesta. */
export function useDeleteSurvey(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      try {
        await api.delete(`/surveys/${id}`);
      } catch (error) {
        if (!isConnectionError(error)) throw error;
      }
      writeLocalSurveys(readLocalSurveys().filter((survey) => survey.id !== id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['surveys'] }),
  });
}

/** Resultados agregados de una encuesta, listos para el dashboard. */
export function useSurveyResults(survey: Survey | undefined) {
  return useQuery<SurveyResultsSummary | undefined>({
    queryKey: ['surveys', survey?.id, 'results'],
    enabled: Boolean(survey),
    queryFn: async () => {
      if (!survey) return undefined;
      try {
        return await api.get<SurveyResultsSummary>(`/surveys/${survey.id}/results`);
      } catch (error) {
        if (!isConnectionError(error)) throw error;
        return computeSurveyResults(survey, readLocalResponses(survey.id));
      }
    },
  });
}

/** Envía una respuesta de encuesta y actualiza el conteo desnormalizado de la encuesta. */
export function useSubmitSurveyResponse(): UseMutationResult<SurveyResponse, Error, SurveyResponse> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (response) => {
      try {
        return await api.post<SurveyResponse, SurveyResponse>(`/surveys/${response.surveyId}/responses`, response);
      } catch (error) {
        if (!isConnectionError(error)) throw error;
        writeLocalResponses(response.surveyId, [...readLocalResponses(response.surveyId), response]);
        writeLocalSurveys(
          readLocalSurveys().map((survey) =>
            survey.id === response.surveyId ? { ...survey, responses: survey.responses + 1 } : survey,
          ),
        );
        return response;
      }
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
      queryClient.invalidateQueries({ queryKey: ['surveys', response.surveyId, 'results'] });
    },
  });
}
