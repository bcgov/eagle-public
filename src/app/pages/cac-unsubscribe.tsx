import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import * as projectApi from 'app/api/project';
import { logger } from 'app/config/logging';
import { useOperationLoading } from 'app/state/loading-state';

/**
 * The unsubscribe link mailed by eagle-api carries Angular matrix parameters
 * (`/cac-unsubscribe;project=X;projectId=Y;email=Z`), which react-router treats as one opaque
 * path segment. Query-string form is read too, so a hand-typed link also works.
 */
function readUnsubscribeParams(pathname: string, search: string): URLSearchParams {
  const segment = decodeURIComponent(pathname.split('/').pop() ?? '');
  const matrix = segment.includes(';') ? segment.slice(segment.indexOf(';') + 1).replace(/;/g, '&') : '';
  return new URLSearchParams(`${matrix}&${search.replace(/^\?/, '')}`);
}

export function CacUnsubscribe() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const loading = useOperationLoading('cac-unsubscribe');

  const params = readUnsubscribeParams(pathname, search);
  const [emailInput, setEmailInput] = useState(params.get('email') || '');
  const [success, setSuccess] = useState(false);
  const projectName = params.get('project') || '';
  const projectId = params.get('projectId') || '';

  function cancel() {
    navigate('/');
  }

  function unsubscribe() {
    projectApi
      .cacRemoveMember(projectId, { email: emailInput, projId: projectId })
      .then(res => {
        logger.info('Successfully unsubscribed from CAC', 'CacUnsubscribe', res);
        setSuccess(true);
      })
      .catch(error => {
        logger.error('Error unsubscribing from CAC', 'CacUnsubscribe', error);
        alert('Uh-oh, error submitting information');
      });
  }

  return (
    <>
      <div className="hero-banner hb-sm">
        <div className="container">
          <div className="container-inner">
            <div className="hero-banner__content">
              <h1>Unsubcribe from Community Advisory Committee</h1>
              <p>Please confirm the email you used to sign up to the Community Advisory Committee.</p>
            </div>
          </div>
        </div>
      </div>

      <section className="static-content mt-2">
        <div className="container" id="anchor-point">
          {loading && (
            <div className="spinner-container">
              <div className="spinner-new rotating"></div>
            </div>
          )}

          {!success && (
            <div className="row">
              <main className="m-5">
                <form onSubmit={event => event.preventDefault()}>
                  <div className="form-group">
                    <span className="control-label">Project</span>
                    <div className="form-control-container">
                      <span>{projectName}</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="emailInput" className="control-label">Email Address</label>
                    <input
                      readOnly
                      required
                      className="form-control"
                      type="text"
                      name="emailInput"
                      id="emailInput"
                      value={emailInput}
                      onChange={event => setEmailInput(event.target.value)}
                    />
                    <button className="btn content-btn-dark mt-2 me-2" type="button" onClick={unsubscribe}>
                      <span>Unsubscribe</span>
                    </button>
                    <button className="btn content-btn-dark mt-2 " type="button" onClick={cancel}>
                      <span>Cancel</span>
                    </button>
                  </div>
                  <div className="form-group">
                    <p>If you are experiencing any issues with unsubscribing please send an email to <a href="mailto:EAO.EPICsystem@gov.bc.ca">EAO.EPICsystem@gov.bc.ca</a></p>
                  </div>
                </form>
              </main>
            </div>
          )}

          {success && (
            <div className="row">
              <p>You have been unsubscribed successfully.  Click <button className="btn content-btn-dark" type="button" onClick={cancel}>
                <span>here</span>
              </button> to go back to the homepage.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
