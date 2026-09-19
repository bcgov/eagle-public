import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PageMasthead } from 'app/layout/page-masthead';
import { HomeSearch } from './home-search';
import { UpdatesFeed } from './updates-feed';
import { UpdateReader } from './update-reader';
import { OpenForComment } from './open-for-comment';
import { RecentUploads } from './recent-uploads';
import { BrowseStrip } from './browse-strip';
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
      </PageMasthead>

      <div className="home-body page-container">
        <div className="home-body__feed">
          <UpdatesFeed />
        </div>
        <div className="home-body__rail">
          <OpenForComment />
          <RecentUploads />
        </div>
      </div>

      <BrowseStrip />

      {id && <UpdateReader key={id} id={id} onClose={closeReader} />}
    </div>
  );
}
