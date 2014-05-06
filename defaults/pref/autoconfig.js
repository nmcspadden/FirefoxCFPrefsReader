
Components.utils.import("file:///Users/admin/HorribleFirefoxIdea/macosx.js");

var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);
macosx.importFramework("CoreFoundation", false);
macosx.importFramework("Foundation", false);
macosx.importFramework("AppKit", false);
var message = macosx.CFStringCreateWithCString(null, "JS-MacOSX: JavaScript-Cocoa Bridge loaded into %@ v%@", macosx.kCFStringEncodingUTF8);
var appName = macosx.CFStringCreateWithCString(null, appInfo.name, macosx.kCFStringEncodingUTF8);
var appVersion = macosx.CFStringCreateWithCString(null, appInfo.version, macosx.kCFStringEncodingUTF8);
macosx.NSLog(message, appName, appVersion);

//For each given preference, we need to check to see if it is forced, and then if it is, get the value
var prefDomain = macosx.CFStringCreateWithCString(null, "org.mozilla.autocfg", macosx.kCFStringEncodingUTF8);

//First, check the homePage
var prefName = macosx.CFStringCreateWithCString(null, "homePage", macosx.kCFStringEncodingUTF8);
var isForced = macosx.CFPreferencesAppValueIsForced(prefName, prefDomain);
if (isForced) {
	//If the value is forced, then we should copy the value to lock the pref with.
	var result = macosx.CFPreferencesCopyAppValue(prefName, prefDomain);
	Preferences.lock("browser.startup.homepage", result);
}

var js_result = macosx.CFStringGetCStringPtr(result, macosx.CFStringGetFastestEncoding(result)).readString();
var message = macosx.CFStringCreateWithCString(null, "JS-MacOSX: Preference %@ result: %@", macosx.kCFStringEncodingUTF8);
macosx.NSLog(message, prefName, result);