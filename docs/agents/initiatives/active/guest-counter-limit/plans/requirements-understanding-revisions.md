# REQUIREMENTS UNDERSTANDING REVISIONS
> The understanding of this initiative's requirements is generally correct, but there are key assumptions being made that are either incorrect or not necessary for the current state of the project.

## General Clarifications
- **Project State:** This project is in development, so there are no active user's to worry about when making schema changes. 
- **Handling Migrations:** During this development stage of the project, when changes are made to the schema that would imply retroactive removal, the migrations can be reset and reinitialized (meaning a single migration covers everything), as there is no need to worry about destructive retroactive removal during this development stage of the project.
- **What Guest User Means:** The intended meaning of a 'guest' account is accounts where `isPremium === false`. This essentially implies that **unless the account has premium status**, the max # of counter's an account can have is 5.

## Key Scope Clarifications
- **Not Only Client Side:** Since the limit applies to accounts that are authenticated but no premium tier (`isAuthenticated === true` but `isPremium === false`), the limit needs to be enforced server side too (so both client and server enforces limit).
    - The server side enforcement can be a simple check to follow the "never trust the client" rule. Since the check should be handled client side, there's no overhead, but a request sent from anywhere other than the client should also fail from the server side check if the user has 5 counters.

## UI/UX Specifics
- **When Modal is Displayed:** The modal is displayed once the user clicks the "Add Counter" button (not even showing the `CounterForm`) and the user already has 5 counters. 
    - This means that the modal should be triggered from `HomeView`.

## Questions Not Already Addressed
- **Q3:** Create a boilerplate view `UpgradeView.vue` where account upgrade can be implemented later. Have the cta navigate to that route.
- **Q4:** Use the `ion-modal` component
- **Q5:** The "Add Counter" button should not be visually different.


