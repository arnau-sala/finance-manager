type HomePageProps = {
  onLogout: () => void;
};

export function HomePage({ onLogout }: HomePageProps) {
  return (
    <main className="home-screen">
      <h1>Home Page</h1>
      <button className="home-logout-button" type="button" onClick={onLogout}>
        Log out
      </button>
    </main>
  );
}
