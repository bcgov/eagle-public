import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PageMasthead } from 'app/layout/page-masthead';
import { HomeSearch } from './home-search';
import { UpdatesFeed } from './updates-feed';
import { UpdateReader } from './update-reader';
import { OpenForComment } from './open-for-comment';
import { RecentUploads } from './recent-uploads';
import { MapExplorer } from './map-explorer';
import { AboutBand } from './about-band';
import { ProjectsByType } from './projects-by-type';
import './home.css';

/** The home page, and at `/updates/:id` the same page with that update open in the reader. */
export function Home() {
  const { id } = useParams();
  const navigate = useNavigate();
  // Replace, so Back after closing does not land on the reader again.
  const closeReader = useCallback(() => navigate('/', { replace: true }), [navigate]);

  return (
    <div className="home">
      {/* The root of the site, so the band carries no trail: there is nowhere above it. */}
      <PageMasthead title="Environmental Assessments">
        <HomeSearch />
        <p className="page-masthead__lede">
          Explore information and documents related to environmental assessments of major projects
          in B.C.
        </p>
      </PageMasthead>

      <div className="home-body page-container">
        <div className="home-body__feed">
          <UpdatesFeed />
        </div>
        <div className="home-body__rail">
          <MapExplorer />
          <OpenForComment />
          <RecentUploads />
        </div>
      </div>

      <ProjectsByType />

      <AboutBand />

      {id && <UpdateReader key={id} id={id} onClose={closeReader} />}
    </div>
  );
}
