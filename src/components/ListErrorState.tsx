import Link from 'next/link';
import { AlertIcon } from './Icons';
import styles from './ListErrorState.module.css';

export function ListErrorState({ message }: { message: string | null }) {
  return (
    <div className={styles.wrapper} role="alert">
      <AlertIcon width={32} height={32} />
      <h1 className={styles.title}>Nie udało się wczytać odcinków</h1>
      <p className={styles.message}>
        {message ?? 'API Polskiego Radia nie odpowiada poprawnie.'}
      </p>
      <p className={styles.hint}>
        Upewnij się, że zmienna <code>NEXT_PUBLIC_API_BASE_URL</code> wskazuje na działający
        adres brzegowy CMS i spróbuj ponownie.
      </p>
      <Link className={styles.button} href="/">
        Spróbuj ponownie
      </Link>
    </div>
  );
}
