import type { ExtendedPage } from '../types';
import { actByYear } from 'app/utils/legislation';

// Act names need no link here: `autoLinks` below links the first mention of each Act.
const MPO = 'https://www.canada.ca/en/privy-council/major-projects-office.html';
const MPO_PROJECT =
  'https://www.canada.ca/en/privy-council/major-projects-office/projects/national/west.html';
const CER = 'https://www.cer-rec.gc.ca/en/';
const TMC = 'https://www.transmountain.com/';
const PM_LISTING =
  'https://www.pm.gc.ca/en/news/news-releases/2026/10/01/prime-minister-carney-lists-west-coast-oil-pipeline-now-known-pacific';
const PM_REFERRAL =
  'https://www.pm.gc.ca/en/news/news-releases/2026/07/02/canada-and-alberta-advance-west-coast-pipeline-project-proposal-and';
const PM_MOU =
  'https://www.pm.gc.ca/en/news/news-releases/2025/11/27/canada-and-alberta-strike-new-partnership-lower-emissions-unlock-our';
const GAZETTE_NOTICE = 'https://gazette.gc.ca/rp-pr/p1/2026/2026-08-01/html/sup1-eng.html';
const ALBERTA_PAGE = 'https://www.alberta.ca/pacific-link';
const ALBERTA_PUBLICATION = 'https://open.alberta.ca/publications/west-coast-oil-pipeline-project';
const ALBERTA_SUBMISSION_PDF =
  'https://open.alberta.ca/dataset/a529e3da-6368-43d7-af43-74b1773be517/resource/6e43e4b4-3dfe-4c28-b723-116b6cab19ea/download/west-coast-oil-pipeline-project-submission-to-mpo.pdf';
const ALBERTA_SUMMARY_PDF =
  'https://open.alberta.ca/dataset/a529e3da-6368-43d7-af43-74b1773be517/resource/c6269884-58fd-40fa-bb52-01d0c0360bc2/download/west-coast-oil-pipeline-project-submission-to-mpo-plain-language-summary.pdf';
const ALBERTA_SUMMARY_FR_PDF =
  'https://open.alberta.ca/dataset/7339333e-86e2-4bcd-9d55-49af9822f114/resource/980a8611-0a05-413c-855d-165e0d09b0cd/download/west-coast-oil-pipeline-project-submission-to-mpo-plain-language-summary-fr.pdf';
const ALBERTA_FACT_SHEET_LAND_WATER =
  'https://www.alberta.ca/system/files/em-west-coast-oil-pipeline-working-together-to-protect-land-and-water.pdf';
const ALBERTA_FACT_SHEET_ECONOMY =
  'https://www.alberta.ca/system/files/em-west-coast-oil-pipeline-working-together-to-build-lasting-economic-growth.pdf';
const BCA_EXPLAINER =
  'https://www.canada.ca/en/one-canadian-economy/services/building-canada-act-projects-national-interest.html';
const BUILDING_CANADA_ACT = actByYear(2025)!;
const EAA = 'https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/18051';
const EAA_SECTION_41 = `${EAA}#section41`;

/** The Act's own process: the Overview band's tiles and the Act tab's steps. */
const ACT_PROCESS = [
  {
    name: 'Referral',
    short: 'Canada refers a project to the MPO',
    detail:
      'The Government of Canada refers a project to the Major Projects Office. Referral does not guarantee funding, approval or listing.',
    note: 'Referred 2 July 2026',
  },
  {
    name: 'Listing consultation',
    short: 'Indigenous Peoples, provinces, ministers',
    detail:
      'Before listing, Canada must consult Indigenous Peoples whose rights may be affected, provinces and territories, and relevant federal ministers.',
    note: 'July to September 2026',
  },
  {
    name: 'Gazette notice and listing',
    short: '30-day notice, then Schedule 1',
    detail:
      'A notice is published in the Canada Gazette at least 30 days before listing, giving the public a chance to comment. The Governor in Council may then add the project to Schedule 1.',
    note: 'Notice 1 August 2026; listed 1 October 2026',
  },
  {
    name: 'Federal review',
    short: 'Consultation and conditions',
    detail:
      'A single regulatory review develops technical conditions to mitigate effects, including measures to protect the environment and Indigenous rights. Federal departments that would normally decide permits advise the Minister instead.',
    note: 'Led by the MPO, supported by the CER, with CER public hearings',
  },
  {
    name: 'Conditions document',
    short: 'One set of binding conditions',
    detail:
      'The Minister of One Canadian Economy issues a single, public set of binding conditions. It can be amended later, with consultation.',
    note: 'Target 1 September 2027',
  },
];

export const pacificLink: ExtendedPage = {
  version: 1,
  displayName: 'Pacific Link',
  masthead: {
    badge: 'Project of national interest',
    subLine: [
      'West Coast Oil Pipeline',
      'Government of Alberta',
      'Bruderheim, Alberta to Roberts Bank, Delta, B.C.',
    ],
    actions: [
      { label: 'Major Projects Office page', href: MPO_PROJECT },
      { label: 'Government of Alberta page', href: ALBERTA_PUBLICATION },
    ],
  },

  panel: {
    timeline: true,
    facts: [
      { label: 'Status', value: 'Listed · federal review starting', statusDot: true },
      {
        label: 'Lead reviewer',
        value: [{ text: 'Major Projects Office', href: MPO }],
        detail: ['Supported by the ', { text: 'Canada Energy Regulator', href: CER }],
      },
      {
        label: 'Conditions target',
        value: '1 September 2027',
        detail: 'Conditions document, then construction',
      },
      { label: 'Type', value: 'Energy', detail: 'Interprovincial crude oil pipeline' },
      {
        label: 'Location',
        value: 'Alberta and B.C.',
        detail: 'Southern route · final route not set',
      },
      {
        label: 'Proponent',
        value: 'Government of Alberta',
        detail: ['Built and operated by ', { text: 'Trans Mountain Corporation', href: TMC }],
      },
    ],
    map: {
      label: 'Map of the two proposed corridors from Bruderheim, Alberta to Roberts Bank, B.C.',
      caption:
        'Approximate corridors, for illustration only. From Appendix 2, Map 1 of the Government of Alberta submission (18 June 2026). The final route has not been set.',
    },
  },

  timeline: {
    title: 'Federal review progress',
    note: 'Building Canada Act · not the B.C. assessment stages',
    // Index into `steps`: Federal review and CER hearings.
    currentStep: 4,
    stateLabels: { complete: 'Complete', current: 'In progress', upcoming: 'Upcoming' },
    steps: [
      {
        name: 'Referred to Major Projects Office',
        dateLabel: '2 Jul 2026',
        detail:
          'Canada referred the West Coast Oil Pipeline to the MPO and started the process to consider listing it under the Building Canada Act.',
      },
      {
        name: 'Listing consultation',
        dateLabel: 'Jul – Sep 2026',
        detail:
          'The MPO consulted more than 130 Indigenous communities, the Government of B.C., and federal permitting departments.',
      },
      {
        name: 'Canada Gazette notice',
        dateLabel: '1 Aug 2026',
        detail:
          'Notice that the Governor in Council may amend Schedule 1 of the Act to list the project.',
      },
      {
        name: 'Listed as national interest',
        dateLabel: '1 Oct 2026',
        detail: 'Added to Schedule 1 of the Building Canada Act. Now known as Pacific Link.',
      },
      {
        name: 'Federal review and CER hearings',
        dateLabel: 'Oct 2026 – 2027',
        detail:
          'Indigenous consultation, public hearings led by the Canada Energy Regulator on technical, environmental, social, cultural, health, safety and security matters, and coordination of federal permits.',
      },
      {
        name: 'Conditions document',
        dateLabel: 'Target 1 Sep 2027',
        detail:
          'Final conditions on ownership, benefits, Indigenous rights, environmental protection, local hiring and oversight. Construction can begin after it is issued.',
      },
    ],
  },

  map: {
    geojsonUrl: '/assets/geojson/pacific-link-corridors.geojson',
    label:
      'Map of two proposed corridors from Bruderheim, Alberta, through Edson, Hinton, Jasper and Kamloops to Roberts Bank near Vancouver',
    attribution: [
      'Approximate, for illustration only. Corridors from Appendix 2, Map 1 of the ',
      { text: 'Government of Alberta submission', href: ALBERTA_SUBMISSION_PDF },
      ' to the Major Projects Office (published 18 June 2026). The final route has not been set.',
    ],
    places: [
      { name: 'Edmonton', coordinates: [-113.49, 53.55] },
      { name: 'Kamloops', coordinates: [-120.33, 50.67] },
      { name: 'Jasper', coordinates: [-118.08, 52.88] },
      { name: 'Vancouver', coordinates: [-123.12, 49.28] },
      { name: 'Edson', coordinates: [-116.43, 53.58] },
      { name: 'Hinton', coordinates: [-117.57, 53.4] },
      { name: 'Chilliwack', coordinates: [-121.95, 49.16] },
    ],
    lines: [
      {
        id: 'original',
        label: 'Original corridor',
        colour: 'line-1',
        width: 4,
        lengthKm: 1246,
        detail:
          'Joins the Trans Mountain Line 2 routing near Wabamun, Alta., and leaves it near Hope, B.C., to continue to Roberts Bank. About 92% within 100 m of disturbed land or infrastructure.',
      },
      {
        id: 'optimized',
        label: 'Optimized corridor',
        colour: 'line-2',
        width: 3,
        markers: true,
        lengthKm: 1211,
        detail:
          'Deviates from the original corridor to avoid challenging construction areas and shorten the distance to Roberts Bank. About 82% within 100 m of disturbed land or infrastructure.',
      },
    ],
  },

  autoLinks: [
    // Inline mentions point at the Justice Laws home page, not the full text.
    { text: BUILDING_CANADA_ACT.label, href: 'https://laws-lois.justice.gc.ca/eng/acts/B-9.89/' },
    {
      text: 'Environmental Assessment Act',
      href: EAA,
      cited: { match: 'section 41', href: EAA_SECTION_41 },
    },
    { text: 'Oil Tanker Moratorium Act', href: 'https://laws-lois.justice.gc.ca/eng/acts/O-2.8/' },
    { text: 'Fisheries Act', href: 'https://laws-lois.justice.gc.ca/eng/acts/F-14/' },
    { text: 'Species at Risk Act', href: 'https://laws-lois.justice.gc.ca/eng/acts/S-15.3/' },
    // Bill C-5 as assented: Justice Laws has no consolidated copy.
    {
      text: 'One Canadian Economy Act',
      href: 'https://www.parl.ca/documentviewer/en/45-1/bill/C-5/royal-assent',
    },
  ],

  updates: [
    {
      date: '1 Oct 2026',
      source: 'Prime Minister of Canada',
      headline: 'Listed as a project of national interest, now known as Pacific Link',
      href: PM_LISTING,
      summary:
        'The project is added to Schedule 1 of the Building Canada Act. The MPO, supported by the CER, will lead the federal review and aims to finalize conditions by 1 September 2027.',
    },
    {
      date: '1 Aug 2026',
      source: 'Canada Gazette',
      headline: 'Canada Gazette notice of intent to list the project',
      href: GAZETTE_NOTICE,
      summary:
        'Canada gave notice that the Governor in Council may amend Schedule 1 to list the West Coast Oil Pipeline.',
    },
    {
      date: 'Jul 2026',
      source: 'Major Projects Office',
      headline: 'Listing consultations begin',
      href: MPO_PROJECT,
      summary:
        'Consultations with Indigenous communities, provincial governments and federal permitting departments on whether to list the project.',
    },
    {
      date: '2 Jul 2026',
      source: 'Prime Minister of Canada',
      headline: 'Project referred to the Major Projects Office',
      href: PM_REFERRAL,
      summary:
        'Canada and Alberta advance the west coast pipeline proposal alongside the Pathways carbon capture project.',
    },
    {
      date: '27 Nov 2025',
      source: 'Governments of Canada and Alberta',
      headline: 'Canada–Alberta memorandum of understanding signed',
      href: PM_MOU,
      summary:
        'Included a declaration that an Alberta oil pipeline to Asian markets, with Indigenous participation, is a project of national interest.',
    },
  ],

  tabs: [
    {
      segment: 'overview',
      replace: true,
      banner: [
        {
          type: 'band',
          id: 'act-band',
          eyebrow: 'How this project is reviewed',
          heading: 'The Building Canada Act',
          paragraphs: [
            "Pacific Link is listed under Schedule 1 of the federal Building Canada Act. Listing replaces separate federal approvals with one review, led by the Major Projects Office, that ends in a single conditions document. The federal review does not follow the Environmental Assessment Office's stages or legislated time limits.",
            "The Act does not change approvals that fall under provincial jurisdiction. Section 41 of B.C.'s Environmental Assessment Act allows an agreement with Canada on an assessment; no agreement has been signed for this project.",
          ],
          steps: ACT_PROCESS.map(({ name, short }) => ({ name, short })),
          primary: { label: 'How the Act works', tab: 'act' },
          secondary: { label: 'Read the Act', href: BUILDING_CANADA_ACT.href },
        },
      ],
      main: [
        {
          type: 'summary',
          id: 'about',
          heading: 'About this project',
          description:
            'The Government of Alberta proposes an interprovincial pipeline to carry up to one million barrels per day of Canadian crude oil from Bruderheim, Alberta to a deepwater port near Delta, B.C., where it would be loaded onto vessels for export. The project is in early development. The precise route has not been set.',
          stats: [
            { label: 'Capacity', value: '1 million barrels/day' },
            { label: 'Length', value: 'Up to ~1,250 km' },
            { label: 'Pump stations', value: 'About 11' },
          ],
          itemsHeading: 'Major components',
          items: [
            'Receipt tank terminal in Bruderheim, Alberta, where product is received, measured, stored and pumped into the pipeline',
            'Pipeline up to approximately 1,250 km long',
            'Power interconnection, transmission, and possible generation',
            'About 11 pump stations to maintain flow rate and pressure',
            'Delivery tank terminal and offshore marine loading facility near Delta, B.C., sized for Very Large Crude Carriers',
          ],
        },
        {
          type: 'routeMap',
          id: 'route',
          heading: 'Route',
          optionsHeading: "Corridor options in Alberta's submission",
          facts: [
            'Both options follow a southern route that largely parallels the existing Trans Mountain pipeline between Wabamun, Alta., and Hope, B.C.',
            'The corridor would pass through the traditional territories of about 90 to 125 Indigenous communities and cross about nine to 11 First Nations reserves in B.C., totalling about 13 to 14 km.',
            "Does not reach B.C.'s North Coast or the Great Bear Sea. No change to the Oil Tanker Moratorium Act is required.",
            'The final route will be set after more geotechnical work and engagement with Indigenous communities, landowners and local governments in Alberta and B.C.',
          ],
        },
        {
          type: 'table',
          id: 'ownership',
          heading: 'Ownership',
          intro: [
            'A new jointly owned company will hold the project. ',
            { text: 'Trans Mountain Corporation', href: TMC },
            ' will design, permit, build and operate it.',
          ],
          rows: [
            {
              name: 'Government of Canada',
              note: 'Through Trans Mountain Corporation',
              value: 'Equal share',
            },
            {
              name: 'Government of Alberta',
              note: 'Through Alberta Petroleum Marketing Commission',
              value: 'Equal share',
            },
            {
              name: 'Pembina Pipeline Corporation',
              note: 'Private investor; opportunity for up to 10% more once in commercial operation',
              value: '10% in construction',
            },
            {
              name: 'Indigenous communities',
              note: 'Equity offer financed through Canada and Alberta loan guarantee programs',
              value: 'Minimum 10% offered',
            },
          ],
          footnote: [
            'Indigenous equity is supported by the ',
            {
              text: 'Alberta Indigenous Opportunities Corporation',
              href: 'https://www.theaioc.com/',
            },
            ' and the ',
            {
              text: 'Canada Indigenous Loan Guarantee Corporation',
              href: 'https://cilgc-cgpac.ca/en',
            },
            '. Terms will be settled before construction.',
          ],
        },
        {
          type: 'statCards',
          id: 'consultation',
          heading: 'Indigenous consultation',
          cards: [
            {
              value: '130+',
              text: 'Indigenous communities near or along potential routes consulted by the Major Projects Office on the listing, July–September 2026.',
              source: { label: 'Prime Minister of Canada', href: PM_LISTING },
            },
            {
              value: '100+',
              text: 'Indigenous communities in Alberta and northern B.C. engaged by Alberta while preparing its submission, October 2025 – June 2026.',
              source: { label: 'Government of Alberta', href: ALBERTA_PAGE },
            },
          ],
          note: [
            'A list of Indigenous Nations participating in the federal review has not been published. See ',
            {
              text: 'Indigenous engagement and consultation under the Building Canada Act',
              href: 'https://www.canada.ca/en/one-canadian-economy/services/building-canada-act-projects-national-interest/indigenous-engagement-consultation.html',
            },
            '.',
          ],
        },
      ],
      aside: [
        { type: 'updates', id: 'updates', heading: 'Updates', shown: 3, tab: 'updates' },
        {
          type: 'definitions',
          id: 'roles',
          heading: 'Who does what',
          items: [
            {
              term: 'Government of Alberta',
              detail: 'Initial proponent; submitted the project to the MPO',
            },
            {
              term: 'Trans Mountain Corporation',
              detail:
                'Designs, permits, builds and operates the project; leads Indigenous and stakeholder engagement',
            },
            {
              term: 'Major Projects Office',
              detail: 'Leads the federal review and sets the conditions document',
            },
            {
              term: 'Canada Energy Regulator',
              detail: 'Supports the review and runs public hearings',
            },
            {
              term: 'B.C. Environmental Assessment Office',
              detail:
                'No agreement with Canada under section 41 of the Environmental Assessment Act has been signed',
            },
          ],
        },
        {
          type: 'projects',
          id: 'related-projects',
          heading: 'Related projects on EPIC',
          items: [
            {
              id: '588511e3aaecd9001b8274d4',
              name: 'Roberts Bank Terminal 2',
              note: 'Proposed marine container terminal at Roberts Bank.',
            },
            {
              id: '5f7229183f4bc0002165e839',
              name: 'GCT Deltaport Expansion - Berth Four',
              note: 'Proposed berth expansion at Deltaport, Roberts Bank.',
            },
            {
              id: '588510a1aaecd9001b813339',
              name: 'Deltaport Third Berth',
              note: 'Existing terminal berth at Roberts Bank.',
            },
            {
              id: '5885121eaaecd9001b82b274',
              name: 'Trans Mountain Expansion',
              note: 'Existing pipeline along the same corridor, operated by Trans Mountain.',
            },
          ],
        },
        {
          type: 'links',
          id: 'related',
          heading: 'Related initiatives',
          style: 'cards',
          items: [
            {
              label: 'Pathways Project',
              href: PM_REFERRAL,
              detail: 'Carbon capture and storage in Alberta, advancing alongside the pipeline',
            },
            {
              label: 'Roberts Bank terminal expansion',
              href: PM_LISTING,
              detail:
                'The Government of Canada is working to expand the container terminal at Roberts Bank to export crude from Pacific Link',
            },
          ],
        },
        {
          type: 'links',
          id: 'sources',
          heading: 'Sources',
          style: 'compact',
          items: [
            { label: 'Major Projects Office: West Coast Oil Pipeline', href: MPO_PROJECT },
            { label: 'Prime Minister news release, 1 Oct 2026', href: PM_LISTING },
            { label: 'Government of Alberta: Pacific Link', href: ALBERTA_PAGE },
            {
              label: 'Government of Alberta project submission',
              href: `${ALBERTA_PUBLICATION}#summary`,
            },
            {
              label: 'Submission to the MPO (PDF, includes corridor map)',
              href: ALBERTA_SUBMISSION_PDF,
            },
            {
              label: 'Submission plain-language summary (PDF)',
              href: ALBERTA_SUMMARY_PDF,
            },
            { label: 'Building Canada Act: projects of national interest', href: BCA_EXPLAINER },
            { label: 'Canada Energy Regulator', href: CER },
            { label: 'Environmental Assessment Act, section 41', href: EAA_SECTION_41 },
          ],
        },
        {
          type: 'contacts',
          id: 'contact',
          heading: 'Contact',
          items: [
            {
              label: 'Federal review',
              link: {
                label: 'Contact the Major Projects Office',
                href: 'https://www.canada.ca/en/privy-council/major-projects-office/contact-us.html',
              },
            },
            {
              label: 'B.C. Environmental Assessment Office',
              link: { label: 'EAO.operations@gov.bc.ca', href: 'mailto:EAO.operations@gov.bc.ca' },
            },
          ],
        },
      ],
    },
    {
      segment: 'act',
      label: BUILDING_CANADA_ACT.label,
      title: 'The Building Canada Act',
      layout: 'wide',
      intro:
        'The Building Canada Act was introduced as part of Bill C-5, the One Canadian Economy Act, and received Royal Assent on 26 June 2025. It lets the Government of Canada streamline federal approvals for projects it lists as being in the national interest. This page summarizes how the Act works, based on Government of Canada information.',
      main: [
        {
          type: 'list',
          id: 'factors',
          heading: 'What the government considers before listing',
          style: 'numbered',
          intro:
            'Factors the Act allows the government to weigh, including the extent to which a project:',
          items: [
            "Strengthens Canada's autonomy, resilience and security",
            'Provides economic or other benefits to Canada',
            'Has a high likelihood of successful execution',
            'Advances the interests of Indigenous Peoples',
            "Contributes to clean growth and to meeting Canada's climate change objectives",
          ],
        },
        {
          type: 'steps',
          id: 'process',
          heading: 'The process',
          noteLabel: 'Pacific Link',
          steps: ACT_PROCESS.map(({ name, detail, note }) => ({ name, detail, note })),
        },
        {
          type: 'columns',
          id: 'changes',
          heading: 'What changes and what does not',
          columns: [
            {
              heading: 'Changes for listed projects',
              items: [
                'Federal approvals under laws in Schedule 2 of the Act are granted at once, subject to a review and conditions.',
                'One conditions document, issued by the Minister of One Canadian Economy, replaces permits that separate ministers would otherwise issue, such as under the Fisheries Act and Species at Risk Act.',
                'The review focuses on how the project proceeds, rather than whether it proceeds.',
              ],
            },
            {
              heading: 'Does not change',
              items: [
                'Approvals that fall under provincial or territorial jurisdiction.',
                "Canada's duty to consult Indigenous Peoples, which applies before listing, before conditions are issued, and before any amendment.",
                'Treaty-based review processes, which, where they apply, must be completed before conditions can be issued.',
              ],
            },
          ],
        },
        {
          type: 'prose',
          id: 'bc-role',
          heading: "B.C.'s role",
          text: "Section 41 of B.C.'s Environmental Assessment Act allows the minister to enter into an agreement with the Government of Canada on any aspect of an assessment. No agreement has been signed for this project.",
        },
      ],
      aside: [
        {
          type: 'links',
          id: 'learn-more',
          heading: 'Learn more',
          style: 'list',
          items: [
            {
              label: 'Building Canada Act (full text)',
              href: BUILDING_CANADA_ACT.href,
            },
            { label: 'Building Canada Act: projects of national interest', href: BCA_EXPLAINER },
            { label: 'Major Projects Office', href: MPO },
            {
              label: 'Order in Council: explanatory note',
              href: 'https://orders-in-council.canada.ca/attachment.php?attach=49089&lang=en',
            },
            { label: 'B.C. Environmental Assessment Act, section 41', href: EAA_SECTION_41 },
          ],
        },
      ],
    },
    {
      segment: 'process',
      label: 'Review process',
      title: 'Review process',
      intro:
        'Listing under the Building Canada Act lets the project proceed through one federal review. The result is a conditions document that serves as the Canada Energy Regulator certificate and bundles federal permits, including Fisheries Act authorizations and Species at Risk Act permits, that separate ministers would otherwise issue.',
      main: [
        { type: 'timeline', id: 'timeline', heading: 'Federal review timeline', framed: true },
        {
          type: 'list',
          id: 'differences',
          heading: 'How this differs from a B.C. assessment',
          framed: true,
          style: 'bulleted',
          items: [
            [
              'The ',
              { text: 'Major Projects Office', href: MPO },
              ' leads, not the Environmental Assessment Office.',
            ],
            [
              'Public hearings are run by the ',
              { text: 'Canada Energy Regulator', href: CER },
              '.',
            ],
            'The outcome is a federal conditions document, not a B.C. environmental assessment certificate.',
            'Section 41 of the Environmental Assessment Act allows B.C. to enter into an agreement with Canada on an assessment. No agreement has been signed for this project.',
          ],
        },
      ],
    },
    {
      segment: 'updates',
      label: 'Updates',
      replace: true,
      count: 'updates',
      main: [
        {
          type: 'updates',
          id: 'title',
          heading: 'Updates',
          intro:
            'Updates on this project from the Government of Canada and the Government of Alberta, newest first.',
        },
      ],
    },
    { segment: 'documents' },
  ],

  documents: {
    empty: {
      title: 'No documents on EPIC yet',
      text: [
        'The Environmental Assessment Office has not published documents for this project on EPIC. For federal review records, see the ',
        { text: 'Major Projects Office project page', href: MPO_PROJECT },
        '.',
      ],
    },
    external: {
      heading: 'Documents published by others',
      intro:
        "Other governments published these documents. They are hosted on those governments' websites. The Environmental Assessment Office did not publish them and does not hold them.",
      groups: [
        {
          publisher: 'Government of Alberta',
          items: [
            {
              title:
                'West coast oil pipeline project : submission by the Government of Alberta to the Major Projects Office for listing under the Building Canada Act',
              date: '2 Jul 2026',
              format: 'PDF',
              pages: 89,
              href: ALBERTA_SUBMISSION_PDF,
            },
            {
              title: 'West coast oil pipeline project : plain language summary of the submission',
              date: '2 Jul 2026',
              format: 'PDF',
              pages: 20,
              href: ALBERTA_SUMMARY_PDF,
            },
            {
              title:
                "Projet d'oléoduc de la côte ouest : résumé en langage clair de la soumission du gouvernement de l’Alberta au Bureau des grands projets en vue d’une inscription en vertu de la Loi sur le bâtiment Canada",
              date: '3 Jul 2026',
              format: 'PDF',
              pages: 23,
              language: { label: 'French', code: 'fr' },
              href: ALBERTA_SUMMARY_FR_PDF,
            },
            // No publication date on the fact sheets or the page that links them.
            {
              title: 'West Coast Oil Pipeline: Working Together to Protect Land and Water',
              format: 'PDF',
              pages: 3,
              href: ALBERTA_FACT_SHEET_LAND_WATER,
            },
            {
              title: 'West Coast Oil Pipeline: Working Together to Build Lasting Economic Growth',
              format: 'PDF',
              pages: 2,
              href: ALBERTA_FACT_SHEET_ECONOMY,
            },
          ],
        },
      ],
    },
  },
};
