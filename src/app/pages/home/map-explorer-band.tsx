import { Link } from 'react-router';

/** Slim band under the masthead that points to the Map Explorer. */
export function MapExplorerBand() {
  return (
    <section className="home-map" aria-labelledby="home-map-heading">
      <div className="home-map__inner page-container">
        <div className="home-map__text">
          <h2 id="home-map-heading" className="home-band__heading">
            Map Explorer
          </h2>
          <p className="home-band__body">
            Find environmental assessment projects by location. Filter by project type, region and
            project phase, then open any project for its documents and updates.
          </p>
        </div>
        <Link className="home-map__open" to="/projects">
          <span className="link-label">Open Map Explorer</span>
          <i className="material-icons" aria-hidden="true">
            map
          </i>
        </Link>
      </div>
    </section>
  );
}
