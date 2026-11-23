import { useState } from 'react';

export function usePagination(initialLimit = 25) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);
  return { page, limit, setPage, setLimit, reset: () => setPage(1) };
}
