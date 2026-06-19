// Native-only Capacitor plugin. The app calls it through Capacitor's
// registerPlugin('InstallReferrer') (see lib/install-referrer.ts), so this
// package ships no JS implementation — it exists only to contribute the Android
// module to the Gradle build during `cap sync`. This stub keeps the package
// resolvable on web/tooling.
module.exports = {};
