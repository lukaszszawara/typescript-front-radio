import { CmsError, fetchEpisodesPage } from '@/lib/cms';
import { EpisodeList } from '@/components/EpisodeList';
import { PlayerProvider } from '@/hooks/usePlayer';
import { PlayerPanel } from '@/components/PlayerPanel';
import { ListErrorState } from '@/components/ListErrorState';
import styles from './page.module.css';

export const revalidate = 300;

const PAGE_SIZE = 20;

export default async function HomePage() {
  let initialPage = null;
  let loadError: string | null = null;

  try {
    initialPage = await fetchEpisodesPage(1, PAGE_SIZE);
  } catch (error) {
    loadError =
      error instanceof CmsError
        ? error.message
        : 'Nie udało się pobrać listy odcinków z API Polskiego Radia.';
  }

  return (
    <PlayerProvider>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true" />
            <div>
              <p className={styles.brandName}>Polskie Radio</p>
              <p className={styles.brandSub}>Player audio / wideo</p>
            </div>
          </div>
        </header>

        <main className={styles.main} id="main">
          {initialPage === null ? (
            <ListErrorState message={loadError} />
          ) : (
            <EpisodeList initialPage={initialPage} />
          )}
        </main>

        <PlayerPanel />
      </div>
    </PlayerProvider>
  );
}
