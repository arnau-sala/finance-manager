import { HomeFooterNav } from "./HomeFooterNav";

type HomePageProps = {
  onLogout: () => void;
};

export function HomePage({ onLogout }: HomePageProps) {
  return (
    <main className="home-screen">
      <section className="home-content" aria-labelledby="home-title">
        <h1 id="home-title">Home Page</h1>
        <button className="home-logout-button" type="button" onClick={onLogout}>
          Log out
        </button>
      </section>

      <HomeFooterNav />
    </main>
  );
}
