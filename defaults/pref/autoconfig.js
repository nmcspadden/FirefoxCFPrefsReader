
Components.utils.import("file:///Users/admin/HorribleFirefoxIdea/macosx.js");

var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);
macosx.importFramework("CoreFoundation", false);
macosx.importFramework("Foundation", false);
macosx.importFramework("AppKit", false);
var intro_message = macosx.CFStringCreateWithCString(null, "JS-MacOSX: JavaScript-Cocoa Bridge loaded into %@ v%@", macosx.kCFStringEncodingUTF8);
var appName = macosx.CFStringCreateWithCString(null, appInfo.name, macosx.kCFStringEncodingUTF8);
var appVersion = macosx.CFStringCreateWithCString(null, appInfo.version, macosx.kCFStringEncodingUTF8);
macosx.NSLog(intro_message, appName, appVersion);

//For each given preference, we need to check to see if it is forced, and then if it is, get the value
var prefDomain = macosx.CFStringCreateWithCString(null, "org.mozilla.autocfg", macosx.kCFStringEncodingUTF8);

var SupportedKeysList = [
	"homePage", //should be a string
	"lockHomePage", //all the rest of these are bools
	"noWelcomePage",
	"noUpgradePage",
	"removeDeveloperTools",
	"removeSetDesktopBackground",
	"noGetAddons",
	"disableAddonsManager",
	"displayBookmarksToolbar",
	"removeSmartBookmarks",
	"removeDefaultBookmarks",
	"dontCheckDefaultBrowser",
	"disablePrivateBrowsing",
	"disableFormFill",
	"dontRememberPasswords",
	"disableSync",
	"disableCrashReporter",
	"disableTelemetry",
	"disableFirefoxHealthReportUpload",
	"disableFirefoxUpdates",
	"dontShowRights",
	"disableResetFirefox",
	"defaultSearchEngine",
	"bookmarks" // should be a dictionary, but not sure how this works in JavaScript yet
];

var config = {
  "description": "Generic config for SSH",
  "version": "1.0",
  "homePage": "http://www.sacredsf.org/",
  "extension": {
    "id": "sacredsf-cck@extensions.sacredsf.org",
    "name": "FirefoxSSH",
    "hide": true
  },
};

function HandlePref(prefName)
//prefName should be a normal Javascript string that will then be converted into a C-type string
{
	var CprefName = macosx.CFStringCreateWithCString(null, prefName, macosx.kCFStringEncodingUTF8);
	var isForced = macosx.CFPreferencesAppValueIsForced(CprefName, prefDomain);
	if (isForced) {
		//If the value is forced, then we should copy the value to lock the pref with.
		var result = macosx.CFPreferencesCopyAppValue(CprefName, prefDomain);
		var js_result = macosx.__NSObjectToJSObject(result);
		var message = macosx.CFStringCreateWithCString(null, "JS-MacOSX: Preference %@ result: %@", macosx.kCFStringEncodingUTF8);
		macosx.NSLog(message, CprefName, result);
		//Now that we've logged the result, we should push it into the actual config.
		config[prefName] = js_result;
		macosx.CFRelease(message);
	}
	macosx.CFRelease(CprefName);
}

//Now iterate through the list
arrayLength = SupportedKeysList.length;
for (var i = 0; i < arrayLength; i++) {
	HandlePref(i);
}

macosx.CFRelease(prefDomain);
macosx.CFRelease(appVersion);
macosx.CFRelease(appName);
macosx.CFRelease(intro_message);