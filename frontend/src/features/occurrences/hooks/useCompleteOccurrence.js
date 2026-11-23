import { occurrencesApi } from '../../../api/occurrences.api.js';
import { useOccurrenceMutation } from './useOccurrence.js';

export const useCompleteOccurrence = (id, options) => useOccurrenceMutation((body) => occurrencesApi.complete(id, body), options);
