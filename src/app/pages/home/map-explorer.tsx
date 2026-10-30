import { Link } from 'react-router';

/** Points to the Map Explorer. */
export function MapExplorer() {
  return (
    <section className="home-map" aria-labelledby="home-map-heading">
      <h2 id="home-map-heading" className="home-heading">
        Map Explorer
      </h2>
      <p className="home-band__body">
        Find projects by location. Filter by project, type, region &amp; phase.
      </p>
      <Link className="home-map__open" to="/projects">
        <span className="link-label">Open Map Explorer</span>
        <i className="material-icons" aria-hidden="true">
          map
        </i>
      </Link>
    </section>
  );
}
