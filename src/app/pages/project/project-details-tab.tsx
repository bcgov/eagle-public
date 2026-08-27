import { newlines } from 'app/utils/newlines';
import { safeHtml } from 'app/utils/safe-html';
import { longDate } from 'app/utils/utils';
import { FeaturedDocuments } from './featured-documents';
import { Pins } from './pins';
import { ProjectActivites } from './project-activites';
import { useProjectContext } from './project-context';
import './project-details-tab.css';

const BC_ENERGY_REGULATOR_LINK = 'https://www.bc-er.ca/data-reports/data-centre/';

export function ProjectDetailsTab() {
  const { project, projectLoading } = useProjectContext();

  return (
    <>
      <h2 className="visually-hidden">Project Details</h2>

      <div className="row">
        <div className="col-12">
          <div className="location-info" aria-busy={projectLoading}>
            {projectLoading && (
              <div className="text-center my-5">
                <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                  <span className="visually-hidden">Loading project details</span>
                </div>
              </div>
            )}
            {!projectLoading && (
              <>
            <p
              className="desc mb-4"
              dangerouslySetInnerHTML={safeHtml(newlines(project?.description?.toString() || '-'))}
            ></p>
            <dl className="row g-3 mb-4">
              <div className="col-sm-6 col-md-4 col-lg-3">
                <dt className="fw-bold text-primary mb-0 lh-sm">Proponent</dt>
                <dd className="mb-1">{project?.proponent?.name || '-'}</dd>
              </div>
              <div className="col-sm-6 col-md-4 col-lg-3">
                <dt className="fw-bold text-primary mb-0 lh-sm">Type</dt>
                <dd className="mb-1">{project?.type || '-'}</dd>
              </div>
              <div className="col-sm-6 col-md-4 col-lg-3">
                <dt className="fw-bold text-primary mb-0 lh-sm">Sub-type</dt>
                <dd className="mb-1">{project?.sector || '-'}</dd>
              </div>
              <div className="col-sm-6 col-md-4 col-lg-3">
                <dt className="fw-bold text-primary mb-0 lh-sm">Nature</dt>
                <dd className="mb-1">{project?.nature || 'No nature description available'}</dd>
              </div>

              {project && (
                <div className="col-sm-6 col-md-4 col-lg-3">
                  <dt className="fw-bold text-primary mb-0 lh-sm">IAAC Involvement</dt>
                  {project.CEAAInvolvement?.name === 'None' ? (
                    <dd className="mb-1">{project.CEAAInvolvement?.name || '-'}</dd>
                  ) : (
                    <dd className="mb-1">
                      <a target="_blank" rel="noopener" href={project.CEAALink}>
                        {project.CEAAInvolvement?.name || '-'}
                        <i
                          className="material-icons"
                          style={{ fontSize: '0.875rem', verticalAlign: 'middle' }}
                          aria-hidden="true"
                        >
                          open_in_new
                        </i>
                        <span className="visually-hidden">(opens in new tab)</span>
                      </a>
                    </dd>
                  )}
                </div>
              )}

              {project?.currentPhaseName && (
                <div className="col-sm-6 col-md-4 col-lg-3">
                  <dt className="fw-bold text-primary mb-0 lh-sm">Project Status</dt>
                  <dd className="mb-1">{project.currentPhaseName?.name || '-'}</dd>
                </div>
              )}

              {project?.eacDecision && (
                <div className="col-sm-6 col-md-4 col-lg-3">
                  <dt className="fw-bold text-primary mb-0 lh-sm">EAC Status</dt>
                  {project.eacDecision?.name === 'Regulatory Transfer' ? (
                    <dd className="mb-1">
                      <a
                        href={project.applicableRegulation?.item || BC_ENERGY_REGULATOR_LINK}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {project.applicableRegulation?.name || 'BC Energy Regulator'}
                      </a>
                    </dd>
                  ) : project.decisionDate ? (
                    <dd className="mb-1">
                      {project.eacDecision?.name || '-'} | {longDate(project.decisionDate)}
                    </dd>
                  ) : (
                    <dd className="mb-1">{project.eacDecision?.name || '-'}</dd>
                  )}
                </div>
              )}

              {project?.operational && (
                <div className="col-sm-6 col-md-4 col-lg-3">
                  <dt className="fw-bold text-primary mb-0 lh-sm">Active Phase</dt>
                  {project.operational?.date ? (
                    <dd className="mb-1">
                      {project.operational?.label || '-'} | {longDate(project.operational.date)}
                    </dd>
                  ) : (
                    <dd className="mb-1">{project.operational?.label || '-'}</dd>
                  )}
                </div>
              )}
            </dl>
              </>
            )}
          </div>
        </div>
      </div>

      <FeaturedDocuments />
      <Pins />
      <ProjectActivites />
    </>
  );
}
