<h1>Simplify Practice</h1>

<blockquote>
<p><strong>Project governance:</strong> this repo is the <em>flow</em> project of the agentic
portfolio. Vision and phases live in <a href="SPEC.md">SPEC.md</a> (personal wellness OS),
engineering constraints in <a href="PRINCIPLES.md">PRINCIPLES.md</a>, operating rules in
<a href="OPERATIONS.md">OPERATIONS.md</a>, and the loop/architecture gates in
<a href="docs/framework-alignment.md">docs/framework-alignment.md</a>. The habit-tracker
app described below is the pre-existing codebase; see
<a href="docs/AGENT_PRINCIPLES.md">docs/AGENT_PRINCIPLES.md</a> for how the shared
principles apply to it.</p>
</blockquote>

<p>A web app project that tracks user's habits. </p>
<p>User can create an account and login</p>
<p>User can add habits and mark them completed for that day. Current streak will appear once the user has completed the habit two or more days in a row.</p>
<p>User can navigate to a page that shows more detailed information of the given habit, like a calendar view of completed and missed days.</P>

<h3>Backend</h3>
<p>Backend is build with Node.js, Express and Typescript, and it uses MongoDb as a data storage</p>
<h3>Frontend</h3>
<p>Client side is made with React and Typescript.</p>

<p>The client side uses Cypress for End-to-End (E2E) tests. To run these tests start backend development server in test mode with <br /> `npm run start:test`<br /> <br />frontend with `npm start`<br /> <br />and open Cypress in /frontend with `npm run cypress:open`<br /></p>

<p>The server side uses Jest and Supertest for integration tests. To run these tests run <br /> `npm test`<br /> in backend root </p>

<img src="https://media.giphy.com/media/vYuSGcdwFHkl80TmZK/giphy.gif" alt="cypress-testing" />

<br />
<p>Both frontend and backend have their own Readme documentation files in their respective folders</p>
