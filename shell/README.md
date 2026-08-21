# eigen_shell

`eigen_shell` is the complete, opinionated EigenInteractive Flutter app: app
startup, routing, sign-in, home, lobby, game chrome, history and replay,
friends, profile, settings, notifications, updates, and theming.

Game rules and rendering depend on [`eigen_flutter`](https://pub.dev/packages/eigen_flutter),
which remains embeddable and does not own a root `MaterialApp`. Applications
that want the standard product import this package and call `runEigenShell`.

See [the EigenInteractive documentation](https://eigeninteractive.com) for the
complete server-and-client setup.
