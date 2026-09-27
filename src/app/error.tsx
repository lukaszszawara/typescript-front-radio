'use client';

import { ListErrorState } from '@/components/ListErrorState';
import styles from './error.module.css';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="pl">
      <body>
        <div className={styles.wrapper}>
          <ListErrorState
            message={error.message || 'Wystąpił nieoczekiwany błąd podczas renderowania strony.'}
          />
        </div>
      </body>
    </html>
  );
}
