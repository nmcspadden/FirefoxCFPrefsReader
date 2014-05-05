
Components.utils.import("file:///Users/admin/HorribleFirefoxIdea/macosx.js");

macosx.importFramework("CoreFoundation", false);
macosx.importFramework("Foundation", false);
macosx.importFramework("AppKit", false);
var message = macosx.CFStringCreateWithCString(null, "JS-MacOSX: JavaScript-Cocoa Bridge loaded into %@ v%@", macosx.kCFStringEncodingUTF8);
macosx.NSLog(message);
var prefName = macosx.CFStringCreateWithCString(null, "CatalogURL", macosx.kCFStringEncodingUTF8);
var prefDomain = macosx.CFStringCreateWithCString(null, "com.apple.SoftwareUpdate", macosx.kCFStringEncodingUTF8);
var result = macosx.CFPreferencesCopyAppValue(prefName, prefDomain);
var js_result = macosx.CFStringGetCStringPtr(result, macosx.CFStringGetFastestEncoding(result)).readString();
var message = macosx.CFStringCreateWithCString(null, "JS-MacOSX: result", macosx.kCFStringEncodingUTF8);
macosx.NSLog(message);
macosx.NSLog(result);