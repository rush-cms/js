# Security policy

If you believe you have found a security vulnerability in Rush CMS, report it privately so it can be fixed before it is disclosed.

## How to report

Use GitHub's private vulnerability reporting on the `rush-cms/js` repository:

1. Open https://github.com/rush-cms/js/security.
2. Choose "Report a vulnerability", or open https://github.com/rush-cms/js/security/advisories/new directly.

The report is visible only to the maintainers.

Never open a public issue, discussion or pull request for a security problem.

## What to include

- The affected version.
- The steps to reproduce the problem.
- The impact you expect it to have.

Test only against an installation you own or are authorized to test.

## What happens next

The maintainers coordinate a fix and a security advisory through GitHub.

## Scope

This policy covers the code in the `rush-cms` repositories: the Rush CMS server and admin, the JavaScript client and the Astro integration. Vulnerabilities in third-party services you connect to Rush CMS, such as your hosting provider, Stripe or your mail provider, should be reported to those vendors.

## Keeping your installation secure

Run the latest release, keep PostgreSQL and Redis off the public internet, and keep API tokens on the server side of your websites. The self-hosting guide in the Rush CMS documentation covers the configuration of a production installation.
