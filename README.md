FirefoxCFPrefsReader
===================

Normally, Firefox doesn't support any kind of MCX or Profiles.  It doesn't support reading from preference files at all.

Instead, Firefox is managed with something like [autoconfig](http://mike.kaply.com/2012/03/16/customizing-firefox-autoconfig-files/) or an add-on that configures the settings you want.  This is very easy thanks to the incredible work by [Mike Kaply](http://mike.kaply.com/) - known as the [Client Customization Kit 2](https://addons.mozilla.org/en-US/firefox/addon/cck2wizard/).  The CCK2 allows you to create an autoconfiguration and/or Firefox addon (XPI) that manages the preferences and settings you want.

Autoconfig files allow you to execute complete JavaScript.  Combine this with another brilliant project - [the JavaScript-Cocoa Bridge](https://code.google.com/p/js-macosx/) and you get the ability to make calls to Mac OS X system frameworks through JavaScript.  

Thus, you can use JavaScript to make calls to [CFPreferences functions](https://developer.apple.com/library/mac/documentation/CoreFoundation/Reference/CFPreferencesUtils/Reference/reference.html).  

You can make a profile that contains the settings you want to manage, and this CCK2.cfg file can read it.

Usage
------

Place the "macosx.js" file in /Library/Application Support/FirefoxCCK/.

Install the accompanied profile (or make one of your own / edit it).  The "Full" profile contains keys for every setting that I manage with the CCK2 for my workstations.  The "minimal" profile contains only a small set, mostly as an example of not setting everything.

Use the CCK2 to generate an autoconfig install, or use the accompanied autoconfig.zip file.  Extract the contents of the zip file and place all of them into Firefox.app/Contents/MacOS/ (do NOT overwrite the browser or defaults/prefs directories - their contents need to merged into the existing ones.  Overwriting the browser folder will cause Firefox to crash on launch).  Replace the "CCK2.cfg" file from the zip with the modified one from this repo.

When you now launch Firefox, you should notice that it now follows the autoconfiguration according to the keys set in your installed profile.

NOTE: These keys are NOT a 1:1 match to Firefox preferences in about:config.  It relies on the CCK2 to translate the keys into actual preferences.  This is something I will probably change in the future, to allow for 1:1 key:preference matching, but that isn't my immediate goal.
