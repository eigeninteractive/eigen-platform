/**
 * Default Terms of Service.
 *
 * A neutral starting template, NOT legal advice. The operator publishing the
 * game is responsible for its accuracy and for having it reviewed. To depart
 * from these terms, pass your own HTML fragment as `site.legal.terms`.
 *
 * Body content only: the engine supplies the document shell, styling and
 * footer. Operator-specific values are typed props, so a mistyped placeholder
 * is a compile error rather than something a reader discovers on the page.
 */

import type { LegalProps } from "./props.js";

export function Terms({ appName, operator }: LegalProps) {
  return (
    <>
      <h1>Terms of Service</h1>
      <p class="meta">Effective {operator.effectiveDate}</p>

      <p class="lead">
        These terms govern your use of {appName} (the “Service”), operated by {operator.name}. By creating an account or otherwise using the Service, you agree to them. If you do not agree, please do not use the Service.
      </p>

      <h2>Who may use the Service</h2>
      <p>You may use the Service if you can form a binding contract with {operator.name} and are not barred from doing so under applicable law. If you are a minor in your jurisdiction, you may use the Service only with the involvement of a parent or guardian.</p>

      <h2>Your account</h2>
      <p>The Service may let you play as a guest before you register. Guest accounts are temporary: they are not recoverable if you lose access to the device, and they may be removed after a period of inactivity.</p>
      <p>You are responsible for activity that happens under your account. Keep your sign-in credentials secure, and tell us promptly if you believe someone else has gained access.</p>

      <h2>Acceptable use</h2>
      <p>When using the Service, you agree not to:</p>
      <ul>
        <li>cheat, exploit defects, or use automated agents in matches meant for human players;</li>
        <li>harass, threaten, impersonate, or abuse other players;</li>
        <li>choose a display name or upload an image that is unlawful, hateful, sexually explicit, or infringes someone else's rights;</li>
        <li>attempt to disrupt, overload, reverse engineer, or gain unauthorised access to the Service;</li>
        <li>use the Service for any unlawful purpose.</li>
      </ul>
      <p>We may suspend or terminate accounts that breach these rules.</p>

      <h2>Content you provide</h2>
      <p>
        You keep ownership of the display name, profile image, and other content you provide. You grant {operator.name} a non-exclusive, worldwide, royalty-free licence to store, reproduce, and display that content for the limited purpose of operating the Service, for example showing your name and avatar to your
        opponents.
      </p>
      <p>You confirm that you have the rights necessary to grant this licence for anything you upload.</p>

      <h2>Our content</h2>
      <p>
        The Service, including its software, design, artwork, and text, belongs to {operator.name} or its licensors and is protected by intellectual-property law. These terms give you a personal, non-exclusive, non-transferable right to use the Service for personal, non-commercial purposes, and nothing more. You may
        not copy, modify, reverse engineer, or redistribute any part of it, and nothing here grants you rights in {operator.name}'s trademarks or logos.
      </p>

      <h2>Fair play and results</h2>
      <p>Match results, ratings, and rankings are determined by the Service and are final. We may correct or reverse results affected by a defect, an interruption, or manipulation.</p>

      <h2>Availability and changes</h2>
      <p>The Service is provided on an ongoing but not guaranteed basis. We may add, change, suspend, or discontinue features at any time, and may need to interrupt the Service for maintenance. We will try to give reasonable notice of significant changes where practical.</p>
      <p>We may update these terms. When we do, we will revise the effective date above, and material changes will be communicated through the Service. Continuing to use the Service after a change means you accept the revised terms.</p>

      <h2>Ending your use</h2>
      <p>
        You may stop using the Service and delete your account at any time; see <a href="/delete-account">Delete Account</a>. We may suspend or end your access if you breach these terms, if required by law, or if we discontinue the Service.
      </p>

      <h2>Disclaimers</h2>
      <p>
        To the maximum extent permitted by law, the Service is provided “as is” and “as available”, without warranties of any kind, whether express or implied, including any implied warranties of merchantability, fitness for a particular purpose, or non-infringement. We do not warrant that the Service will be
        uninterrupted, secure, or error-free.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, {operator.name} will not be liable for any indirect, incidental, special, consequential, or exemplary damages, or for any loss of data, profits, or goodwill, arising from your use of the Service. Nothing in these terms limits liability that cannot be limited under
        applicable law.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of {operator.jurisdiction}, without regard to its conflict-of-laws rules. Any dispute will be subject to the courts of {operator.jurisdiction}, except where applicable law grants you the right to bring proceedings elsewhere.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms can be sent to <a href={`mailto:${operator.contactEmail}`}>{operator.contactEmail}</a>.
      </p>
    </>
  );
}
