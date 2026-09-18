import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { HomeSearch } from './home-search';
import { UpdatesFeed } from './updates-feed';
import { UpdateReader } from './update-reader';
import { OpenForComment } from './open-for-comment';
import { RecentUploads } from './recent-uploads';
import { BrowseStrip } from './browse-strip';
import './home.css';

const INTRO =
  "British Columbia's environmental assessment process provides opportunities for Indigenous Nations, government agencies and the public to influence the outcome of environmental assessments in British Columbia.";

/** The home page, and at `/updates/:id` the same page with that update open in the reader. */
export function Home() {
  const { id } = useParams();
  const navigate = useNavigate();
  // Replace, so Back after closing does not land on the reader again.
  const closeReader = useCallback(() => navigate('/', { replace: true }), [navigate]);

  return (
    <div className="home">
      <section className="home-band" aria-label="Environmental Assessments">
        <div className="home-band__inner">
          <h1 className="home-band__title">Environmental Assessments</h1>
          <p className="home-band__intro">{INTRO}</p>
          <HomeSearch />
        </div>
      </section>

      <div className="home-body">
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
