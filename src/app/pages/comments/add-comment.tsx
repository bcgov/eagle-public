import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Comment } from 'app/models/comment';
import { CommentPeriod } from 'app/models/commentperiod';
import { Document } from 'app/models/document';
import { Project } from 'app/models/project';
import * as commentApi from 'app/api/comment';
import * as documentApi from 'app/api/document';
import * as projectApi from 'app/api/project';
import { listsQueryOptions } from 'app/api/api';
import { logger } from 'app/config/logging';
import { track } from 'app/analytics/analytics';
import { safeHtml } from 'app/utils/safe-html';
import { FileUpload } from 'app/components/file-upload';
import './add-comment.css';

/** Angular's `Validators.email` pattern, so the same addresses pass here as passed in the Angular form. */
const EMAIL_REGEXP =
  /^(?=.{1,254}$)(?=.{1,64}@)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const ANONYMOUS_NAME = 'Anonymous';

/** Approximate byte size (keys + data), used to decide whether the submission is slow enough to warrant a progress panel. */
function sizeof(o: Record<string, unknown>): number {
  let bytes = 0;
  Object.keys(o).forEach((key) => {
    bytes += key.length;
    const obj = o[key];
    switch (typeof obj) {
      case 'boolean':
        bytes += 4;
        break;
      case 'number':
        bytes += 8;
        break;
      case 'string':
        bytes += 2 * obj.length;
        break;
      case 'object':
        if (obj) {
          bytes += sizeof(obj as Record<string, unknown>);
        }
        break;
    }
  });
  return bytes;
}

interface AddCommentProps {
  currentPeriod: CommentPeriod;
  project: Project;
  onDismiss: (reason: string, page: number) => void;
}

export function AddComment({ currentPeriod, project, onDismiss }: AddCommentProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [totalSize, setTotalSize] = useState(0);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [contactName, setContactName] = useState(ANONYMOUS_NAME);
  const [commentInput, setCommentInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [makePublic, setMakePublic] = useState(false);
  const [agreeConditions, setAgreeConditions] = useState(false);

  // CAC
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [emailConfirmInput, setEmailConfirmInput] = useState('');
  const [caclocationInput, setCaclocationInput] = useState('');
  const [liveNear, setLiveNear] = useState(false);
  const [liveNearInput, setLiveNearInput] = useState('');
  const [memberOf, setMemberOf] = useState(false);
  const [memberOfInput, setMemberOfInput] = useState('');
  const [knowledgeOf, setKnowledgeOf] = useState(false);
  const [knowledgeOfInput, setKnowledgeOfInput] = useState('');
  const [additionalNotesInput, setAdditionalNotesInput] = useState('');
  const [submittedCAC, setSubmittedCAC] = useState(false);
  const [hasSeenCAC, setHasSeenCAC] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [termsOfReference, setTermsOfReference] = useState(false);

  const commentTip = String(currentPeriod?.commentTip || '');

  const { data: lists } = useQuery(listsQueryOptions());
  const documentAuthorType = lists?.find(
    (item) => item.type === 'author' && item.name === 'Public',
  );

  useEffect(() => {
    dialogRef.current?.showModal();
    track('Comment Modal Opened', {
      project_id: project?._id,
      project_name: project?.name,
      comment_period_id: currentPeriod?._id,
    });
    // Opening is a one-shot; the modal is unmounted rather than re-targeted at another period.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss(reason: string) {
    onDismiss(reason, currentPage);
  }

  function addFiles(files: File[]) {
    setDocuments((current) => {
      const next = [...current];
      for (const file of files) {
        if (!file || next.find((x) => x.documentFileName === file.name)) {
          continue;
        }
        const document = new Document();
        document.upfile = file;
        document.documentFileName = file.name;
        document.internalOriginalName = file.name;
        next.push(document);
      }
      return next;
    });
  }

  function deleteFile(doc: Document) {
    setDocuments((current) =>
      current.filter((item) => item.documentFileName !== doc.documentFileName),
    );
  }

  function learnMore() {
    setHasSeenCAC(true);
    track('Comment Modal CAC Learn More Clicked', {
      project_id: project?._id,
      project_name: project?.name,
    });
    setCurrentPage(2);
  }

  function p1_next() {
    if (submittedCAC || !project?.projectCAC || !hasSeenCAC) {
      setCurrentPage(5);
    } else {
      setCurrentPage(2);
    }
  }

  function p2_becomeAMember() {
    track('Comment Modal Become Member Clicked', {
      project_id: project?._id,
      project_name: project?.name,
    });
    setCurrentPage((page) => page + 1);
  }

  async function p3_next() {
    setSubmitting(true);
    try {
      await projectApi.cacSignUp(project, {
        name: nameInput,
        email: emailInput,
        liveNear,
        liveNearInput,
        memberOf,
        memberOfInput,
        knowledgeOf,
        knowledgeOfInput,
        additionalNotes: additionalNotesInput,
      });
      logger.info('CAC sign-up submitted successfully', 'AddComment');
      track('CAC Signup Completed', { project_id: project._id, project_name: project.name });
      setSubmitting(false);
      setSubmittedCAC(true);
      setCurrentPage((page) => page + 1);
    } catch (error) {
      logger.error('Error submitting CAC sign-up', 'AddComment', error);
      alert('Uh-oh, error submitting information');
      setSubmitting(false);
    }
  }

  async function p5_next() {
    setSubmitting(true);

    const comment = new Comment();
    comment.period = currentPeriod?._id ?? null;
    comment.author = contactName;
    comment.comment = commentInput;
    comment.location = locationInput;
    comment.isAnonymous = !makePublic;
    comment.submittedCAC = submittedCAC;

    const filesList = documents.map((item) => item.upfile);
    setTotalSize(
      filesList.reduce(
        (sum, file) => sum + file.size,
        sizeof(comment as unknown as Record<string, unknown>),
      ),
    );

    try {
      const savedComment = await commentApi.add(comment);
      if (!savedComment) throw new Error('Failed to save comment');

      await Promise.all(
        filesList.map((file) => {
          const formData = new FormData();
          formData.append('_comment', savedComment._id);
          formData.append('displayName', file.name);
          formData.append('documentSource', 'COMMENT');
          formData.append('documentAuthor', savedComment.author);
          if (documentAuthorType?._id) {
            formData.append('documentAuthorType', documentAuthorType._id);
          }
          if (project) {
            formData.append('project', project._id);
          }
          formData.append('documentFileName', file.name);
          formData.append('internalOriginalName', file.name);
          formData.append('dateUploaded', new Date().toISOString());
          formData.append('upfile', file);
          return documentApi.add(formData);
        }),
      );

      track('Comment Submitted', {
        project_id: project?._id,
        project_name: project?.name,
        comment_period_id: currentPeriod?._id,
        is_anonymous: !makePublic,
        has_attachments: filesList.length > 0,
        attachment_count: filesList.length,
      });

      setSubmitting(false);
      setCurrentPage((page) => page + 1);
    } catch (error) {
      logger.error('Error submitting comment', 'AddComment', error);
      alert('Uh-oh, error submitting comment');
      setSubmitting(false);
    }
  }

  const cacSignUpValid =
    !!nameInput &&
    EMAIL_REGEXP.test(emailInput) &&
    EMAIL_REGEXP.test(emailConfirmInput) &&
    acknowledged &&
    termsOfReference;

  // The name field is disabled unless the commenter opts in, and Angular skipped disabled
  // controls when deciding form validity.
  const commentValid = !!locationInput && (!makePublic || !!contactName);

  return (
    <dialog
      ref={dialogRef}
      className="modal-dialog modal-lg"
      aria-label="Submit a Comment"
      onCancel={(event) => {
        event.preventDefault();
        dismiss('Escape key press');
      }}
    >
      {/* only show when submitting larger submissions */}
      {submitting && totalSize > 100000 && (
        <div className="modal-content progress-content">
          <div className="modal-body">
            <h4 className="modal-title mb-3">Submitting your comment...</h4>
          </div>
        </div>
      )}

      {/* FIRST PAGE */}
      <form onSubmit={(event) => event.preventDefault()}>
        {currentPage === 1 && (
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Submit a Comment</h4>
              <button
                className="btn-close gtm-submit-comment_cancel-pg1"
                type="button"
                aria-label="Close"
                onClick={() => dismiss('dismissed page1')}
              ></button>
            </div>

            <div className="modal-body">
              <section>
                <h2>How it Works</h2>
                <p>
                  All accepted comments submitted to the Environmental Assessment Office (EAO) will
                  be published online within seven days of receipt. Comments are not accepted if -
                  in the EAO&apos;s view - they are profane, abusive or do not relate to the matter
                  being consulted upon as stated in our{' '}
                  <a
                    href="https://www2.gov.bc.ca/assets/gov/environment/natural-resource-stewardship/environmental-assessments/commenting-on-projects/public_comment_policy_v10.pdf"
                    target="_blank"
                  >
                    Public Comment Policy [PDF]
                  </a>
                  .
                </p>
                <p>All accepted comments are taken into consideration by EAO.</p>
                <p>
                  <strong>To ensure your comment meets EAO&apos;s requirements:</strong>
                </p>
                <ul>
                  <li>Provide your location (City or Town)</li>
                  <li>
                    Identify if you would like to remain anonymous or display your name publicly
                  </li>
                  <li>
                    Comments{' '}
                    <strong>
                      <u>must not</u>
                    </strong>{' '}
                    contain personal or otherwise identifying information of yourself or any other
                    individuals{' '}
                    <strong>
                      <u>in the text of the submission and/or attachments</u>
                    </strong>{' '}
                    (e.g. home/work address, email address, telephone number)
                  </li>
                  <li>
                    Comments that contain profanity, abusive or intolerant language or does not
                    relate to the matter being consulted upon, will not be accepted
                  </li>
                  <li>
                    Attachments must be no larger than 10 MB and must be a .png, .pdf, .gif, .jpg,
                    .jpeg, .doc, .docx, .xls, .xlst, .ppt, .rtf, .pptx, .txt or .bmp file
                  </li>
                </ul>
              </section>
              <section className="mb-0 mt-5">
                <h2>Collection Notice</h2>
                <p>
                  Your personal information is collected by the Environmental Assessment Office for
                  the purpose of commenting on the <em>{project.name} Project</em> under the
                  authority of s.26(c) of the{' '}
                  <a
                    href="http://www.bclaws.ca/Recon/document/ID/freeside/96165_00"
                    target="_blank"
                  >
                    Freedom of Information and Protection of Privacy Act
                  </a>
                  . In submitting your comment, you consent to your comment being published online
                  and shared with the proponent. This consent is valid from this date forward and
                  may be revoked by contacting the EAO representative below. Should you have any
                  questions about this collection please contact:
                </p>
                <p className="mb-0">
                  Director, Digital Services
                  <br />
                  Environmental Assessment Office
                  <br />
                  836 Yates Street, Victoria, BC
                  <br />
                  <a href="mailto: EAO.EPICsystem@gov.bc.ca">EAO.EPICsystem@gov.bc.ca</a>
                  <br />
                  (250) 356-7441
                </p>
              </section>
            </div>
            <div className="modal-footer">
              <div>
                <label className="control-label">
                  <input
                    className="me-1"
                    name="agreeConditions"
                    type="checkbox"
                    checked={agreeConditions}
                    onChange={(event) => setAgreeConditions(event.target.checked)}
                  />
                  I have read the above and understand what my submission should/shouldn&apos;t
                  include
                </label>
              </div>
              <button
                type="button"
                className="btn btn-warning"
                disabled={!agreeConditions}
                onClick={p1_next}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Interested in CAC Form */}
      <form onSubmit={(event) => event.preventDefault()}>
        {currentPage === 2 && (
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Community Advisory Committee</h4>
              <button
                className="btn-close gtm-submit-comment_cancel-pg1"
                type="button"
                aria-label="Close"
                onClick={() => dismiss('dismissed page1')}
              ></button>
            </div>

            <div className="modal-body">
              <section>
                <h3>What is a Community Advisory Committee?</h3>
                <p>
                  The Community Advisory Committee is a way for interested members of the public who
                  are able to advise the Environmental Assessment Office on the potential effects of
                  a project on a community to actively participate in and stay informed about an
                  environmental assessment by:
                </p>
                <ul>
                  <li>learning more about a proposed project;</li>
                  <li>staying up to date on the progress of the environmental assessment; and</li>
                  <li>
                    being informed of opportunities to provide their input and advice during the
                    public comment periods and other engagement activities.
                  </li>
                </ul>
                <p>
                  Feedback from Community Advisory Committee members contributes to a better
                  understanding of the potential effects of the proposed project on the community.
                  The Environmental Assessment Office forms and operates Community Advisory
                  Committees digitally through EPIC.
                </p>
              </section>
              <section className="mb-0">
                <h3>What can I expect as a Community Advisory Committee Member?</h3>
                <p>
                  The Environmental Assessment Office will provide subscribed Community Advisory
                  Committee members information on the environmental assessment process and the
                  proposed project, including notifications of process milestones, when and where
                  key documents are posted, information on public comment periods and any other
                  engagement opportunities. Members will be invited to provide their input through
                  the public comment periods held throughout the environmental assessment and,
                  depending on the overall interest of Community Advisory Committee members, the
                  Environmental Assessment Office may directly seek the advice of Community Advisory
                  Committee members and establish other engagement opportunities. See the
                  <a
                    href="https://www2.gov.bc.ca/assets/gov/environment/natural-resource-stewardship/environmental-assessments/guidance-documents/2018-act/community_advisory_committee_guideline_v1.pdf"
                    target="_blank"
                  >
                    {' '}
                    <strong>Community Advisory Committee Guideline</strong>{' '}
                  </a>{' '}
                  and the{' '}
                  <a
                    href="https://www2.gov.bc.ca/assets/gov/environment/natural-resource-stewardship/environmental-assessments/guidance-documents/2018-act/community_advisory_committee_guideline_v1.pdf#page=8"
                    target="_blank"
                  >
                    <strong>Community Advisory Committee Terms of Reference</strong>
                  </a>{' '}
                  for further information.
                </p>
              </section>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline-white"
                type="button"
                onClick={() => setCurrentPage((page) => page - 1)}
              >
                Back
              </button>
              <button className="btn btn-light" type="button" onClick={() => setCurrentPage(5)}>
                No Thanks
              </button>
              <button type="button" className="btn btn-warning" onClick={p2_becomeAMember}>
                Become a Member
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Contact Information Form */}
      <form onSubmit={(event) => event.preventDefault()}>
        {currentPage === 3 && (
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Community Advisory Committee</h4>
              <button
                className="btn-close gtm-submit-comment-cancel-pg2"
                type="button"
                aria-label="Close"
                onClick={() => dismiss('dismissed page2')}
              ></button>
            </div>
            <div className="modal-body">
              <fieldset>
                <h5 className="modal-title">Member Sign-up</h5>

                <div className="mb-3 row">
                  <div className="mb-3">
                    <label htmlFor="nameInput" className="control-label">
                      Full Name *
                    </label>
                    <div className="form-control-container">
                      <input
                        required
                        className="form-control"
                        type="text"
                        name="nameInput"
                        id="nameInput"
                        value={nameInput}
                        onChange={(event) => setNameInput(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="caclocationInput" className="control-label">
                      Location
                    </label>
                    <div className="form-control-container">
                      <input
                        className="form-control"
                        type="text"
                        name="caclocationInput"
                        id="caclocationInput"
                        value={caclocationInput}
                        onChange={(event) => setCaclocationInput(event.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="mb-3 row">
                  <div className="mb-3">
                    <label htmlFor="emailInput" className="control-label">
                      Email Address *
                    </label>
                    <div className="form-control-container">
                      <input
                        required
                        className="form-control"
                        type="text"
                        name="emailInput"
                        id="emailInput"
                        value={emailInput}
                        onChange={(event) => setEmailInput(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="emailConfirmInput" className="control-label">
                      Confirm Email Address *
                    </label>
                    <div className="form-control-container">
                      <input
                        required
                        className="form-control"
                        type="text"
                        name="emailConfirmInput"
                        id="emailConfirmInput"
                        value={emailConfirmInput}
                        onChange={(event) => setEmailConfirmInput(event.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <span className="control-label">Describe your interest in the project</span>
                  <div>
                    <p className="font-italic understandText">
                      Please select all that apply. You may include additional details or
                      information regarding your interest in the text box below. This information is
                      for the EAO to better understand the membership of the committee, any
                      information you provide here will not be considered as input into the
                      assessment of the project. Please submit your comments on the proposed project
                      through the public comment periods throughout the environmental assessment.
                    </p>
                  </div>

                  {/* I live near */}
                  <div className="mb-3 row">
                    <label className="control-label">
                      <input
                        className="me-1"
                        name="liveNear"
                        type="checkbox"
                        checked={liveNear}
                        onChange={(event) => setLiveNear(event.target.checked)}
                      />
                      I live near or have particular knowledge of the project area
                    </label>
                    {liveNear && (
                      <input
                        className="form-control col-12"
                        type="text"
                        name="liveNearInput"
                        id="liveNearInput"
                        value={liveNearInput}
                        onChange={(event) => setLiveNearInput(event.target.value)}
                      />
                    )}
                  </div>
                  {/* I am a member of */}
                  <div className="mb-3 row">
                    <label className="control-label">
                      <input
                        className="me-1"
                        name="memberOf"
                        type="checkbox"
                        checked={memberOf}
                        onChange={(event) => setMemberOf(event.target.checked)}
                      />
                      I am a member of an organization with an interest in the project (provide
                      organization name below)
                    </label>
                    {memberOf && (
                      <input
                        className="form-control col-12"
                        type="text"
                        name="memberOfInput"
                        id="memberOfInput"
                        value={memberOfInput}
                        onChange={(event) => setMemberOfInput(event.target.value)}
                      />
                    )}
                  </div>
                  {/* I have knowledge of */}
                  <div className="mb-3 row">
                    <label className="control-label">
                      <input
                        className="me-1"
                        name="knowledgeOf"
                        type="checkbox"
                        checked={knowledgeOf}
                        onChange={(event) => setKnowledgeOf(event.target.checked)}
                      />
                      I have particular knowledge of issues relevant to the potential project
                    </label>
                    {knowledgeOf && (
                      <input
                        className="form-control col-12"
                        type="text"
                        name="knowledgeOfInput"
                        id="knowledgeOfInput"
                        value={knowledgeOfInput}
                        onChange={(event) => setKnowledgeOfInput(event.target.value)}
                      />
                    )}
                  </div>
                  {/* Additional Notes */}
                  <div className="mb-3 row">
                    <label htmlFor="additionalNotesInput" className="control-label">
                      Additional Notes:
                    </label>
                    <textarea
                      className="form-control"
                      rows={4}
                      name="additionalNotesInput"
                      id="additionalNotesInput"
                      value={additionalNotesInput}
                      onChange={(event) => setAdditionalNotesInput(event.target.value)}
                    ></textarea>
                  </div>
                </div>

                <div className="mb-3">
                  <span className="control-label understandText">I understand that...</span>
                  <p className="font-italic understandText">
                    Your personal information is collected by the Environmental Assessment Office
                    for the purpose of sending you updates on {project.name} project under the
                    authority of s.26(c) of the Freedom of Information and Protection of Privacy
                    Act. In submitting your comment, you consent to receiving updates to the email
                    address you have provided. This consent is valid from this date forward and may
                    be revoked by contacting the EAO representative below. Should you have any
                    questions about this collection, or wish to revoke your consent please contact:
                  </p>
                  <ul className="font-italic understandText m-0">Director, Digital Services</ul>
                  <ul className="font-italic understandText m-0">
                    Environmental Assessment Office
                  </ul>
                  <ul className="font-italic understandText m-0">836 Yates Street, Victoria, BC</ul>
                  <ul className="font-italic understandText m-0">EAO.EPICsystem@gov.bc.ca</ul>
                  <ul className="font-italic understandText m-0 mb-2">(250) 356-7441</ul>
                  <div className="form-control-container">
                    <label className="control-label">
                      <input
                        required
                        type="checkbox"
                        aria-label="Checkbox for row item"
                        name="acknowledged"
                        checked={acknowledged}
                        onChange={(event) => setAcknowledged(event.target.checked)}
                      />
                      By checking this box, I acknowledge that I understand the above text.
                    </label>
                  </div>
                  <div className="form-control-container">
                    <label className="control-label">
                      <input
                        required
                        type="checkbox"
                        aria-label="Checkbox for row item"
                        name="termsOfReference"
                        checked={termsOfReference}
                        onChange={(event) => setTermsOfReference(event.target.checked)}
                      />
                      By checking this box, I acknowledge that I have read, understood, and will
                      abide by the{' '}
                      <a
                        href="https://www2.gov.bc.ca/assets/gov/environment/natural-resource-stewardship/environmental-assessments/guidance-documents/2018-act/community_advisory_committee_guideline_v1.pdf#page=8"
                        target="_blank"
                      >
                        Community Advisory Committee Terms of Reference
                      </a>
                    </label>
                  </div>
                </div>
              </fieldset>
            </div>
            <div className="modal-footer">
              {/* enable submission when required fields are entered and when either a file or comment is entered */}
              <button
                className="btn btn-outline-white"
                type="button"
                onClick={() => setCurrentPage((page) => page - 1)}
              >
                Back
              </button>
              <button
                className="btn btn-warning"
                type="button"
                onClick={p3_next}
                disabled={!cacSignUpValid || emailInput !== emailConfirmInput}
              >
                Complete Submission
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Success */}
      {currentPage === 4 && (
        <div className="modal-content thank-you-content">
          <div className="modal-header">
            <button
              className="btn-close gtm-submit-comment-cancel-pg3"
              type="button"
              aria-label="Close"
              onClick={() => dismiss('dismissed page3')}
            ></button>
          </div>
          <div className="modal-body pb-5">
            <div className="thank-you-icon mt-4"></div>
            <h4 className="my-4">Thank you for becoming a Community Advisory Committee Member</h4>
            <p className="mb-4">You are now a member of this group!</p>
            <p className="mb-4">
              We will be communicating with members of the Community Advisory Committee over the
              assessment stages of this project. We will send out emails to members of this
              committee at key points through the assessment.
            </p>
            <p className="mb-4">
              Please add <a href={`mailto:${project.cacEmail}`}>{project.cacEmail}</a> to your
              contacts to ensure that our emails go to your inbox and are not filtered to your Spam
              folder.
            </p>
            <button
              className="btn btn-warning"
              type="button"
              onClick={() => setCurrentPage((page) => page + 1)}
            >
              Continue to Commenting
            </button>
          </div>
        </div>
      )}

      {/* Contact Information Form */}
      <form onSubmit={(event) => event.preventDefault()}>
        {currentPage === 5 && (
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Submit a Comment</h4>
              <button
                className="btn-close gtm-submit-comment-cancel-pg2"
                type="button"
                aria-label="Close"
                onClick={() => dismiss('dismissed page2')}
              ></button>
            </div>
            <div className="modal-body">
              <fieldset>
                <div className="mb-3">
                  <label htmlFor="locationInput" className="control-label">
                    Location *
                  </label>
                  <input
                    required
                    className="form-control"
                    type="text"
                    name="locationInput"
                    placeholder="IE: City, Province, etc."
                    id="locationInput"
                    maxLength={50}
                    value={locationInput}
                    onChange={(event) => setLocationInput(event.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="commentInput" className="control-label">
                    Your Comment Submission*
                  </label>
                  {commentTip && (
                    <div className="comment-tip-container">
                      <i className="material-icons">error_outline</i>
                      <p dangerouslySetInnerHTML={safeHtml(commentTip)}></p>
                    </div>
                  )}
                  <textarea
                    className="form-control"
                    rows={8}
                    name="commentInput"
                    id="commentInput"
                    value={commentInput}
                    onChange={(event) => setCommentInput(event.target.value)}
                    placeholder="Comments must not contain personal or otherwise identifying information of yourself or any other individuals within your text submission and/or attachment (e.g. home/work address, email address, telephone number)."
                  ></textarea>
                </div>
                <FileUpload
                  maxFiles={15}
                  maxSize={10}
                  showList={false}
                  files={documents.map((doc) => doc.upfile)}
                  onFilesChange={addFiles}
                />
                {documents.length > 0 && (
                  <ul className="doc-list mb-3">
                    {documents.map((doc) => (
                      <li key={doc.documentFileName}>
                        <span className="cell icon">
                          <i className="material-icons">insert_drive_file</i>
                        </span>
                        <span className="cell name" title={doc.displayName || ''}>
                          <span className="cell__txt-content">{doc.internalOriginalName}</span>
                        </span>
                        <span className="cell actions">
                          <button
                            className="btn btn-icon"
                            type="button"
                            title="Remove this file"
                            onClick={() => deleteFile(doc)}
                          >
                            <i className="material-icons">delete</i>
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {documents.length === 0 && (
                  <div>
                    <p>No attached files.</p>
                  </div>
                )}
                <div className="mb-3">
                  <span className="control-label">
                    Name <em>(All comments are submitted anonymously by default.)</em>
                  </span>
                </div>
                <div className="mb-3">
                  <label className="control-label">
                    <input
                      type="checkbox"
                      aria-label="Checkbox for row item"
                      name="anonymous"
                      checked={makePublic}
                      onChange={(event) => {
                        setMakePublic(event.target.checked);
                        setContactName(event.target.checked ? '' : ANONYMOUS_NAME);
                      }}
                    />
                    Please make my name visible to the public.
                  </label>
                  <div>
                    <em>
                      If you would like to add and display your name on the public website ensure
                      you <u>select &quot;Please make my name visible to the public&quot;</u>
                    </em>
                  </div>
                </div>
                <div className="mb-3">
                  <div className="form-control-container">
                    <input
                      required
                      className="form-control"
                      type="text"
                      name="nameInput"
                      maxLength={50}
                      id="nameInput"
                      value={contactName}
                      onChange={(event) => setContactName(event.target.value)}
                      disabled={!makePublic}
                    />
                  </div>
                </div>
                {project.projectCAC && project.projectCACPublished && (
                  <div className="mb-3">
                    <label className="control-label">
                      <input
                        type="checkbox"
                        aria-label="Checkbox for row item"
                        name="submittedCAC"
                        checked={submittedCAC}
                        onChange={(event) => setSubmittedCAC(event.target.checked)}
                      />
                      I&apos;m a Community Advisory Committee Member.
                    </label>
                    <button type="button" className="btn btn-link mb-1" onClick={learnMore}>
                      <span className="float-end">Learn More</span>
                    </button>
                  </div>
                )}
              </fieldset>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline-white"
                type="button"
                onClick={() => setCurrentPage(1)}
              >
                Back
              </button>
              {/* enable submission when required fields are entered and when either a file or comment is entered */}
              <button
                className="btn btn-warning"
                type="button"
                onClick={p5_next}
                disabled={!commentValid || (!commentInput && documents.length === 0) || submitting}
              >
                Submit
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Success */}
      {currentPage === 6 && (
        <div className="modal-content thank-you-content">
          <div className="modal-header">
            <button
              className="btn-close gtm-submit-comment-cancel-pg3"
              type="button"
              aria-label="Close"
              onClick={() => dismiss('dismissed page3')}
            ></button>
          </div>
          <div className="modal-body pb-5">
            <div className="thank-you-icon mt-4"></div>
            <h4 className="my-4">Your comment has been submitted!</h4>
            <p className="mb-4">
              Thank you for participating in the public comment period for the {project.name}{' '}
              Project.
            </p>
            <button
              className="btn btn-warning"
              type="button"
              onClick={() => dismiss('closed page4')}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
