// *******************************************************************************************************
// macosx.js
// Mozilla JavaScript-Cocoa Bridge
//
// Created by Vachik Hovhannisyan on 1/27/2013
// *******************************************************************************************************
// Copyright (c) 2013, Vachik Hovhannisyan
// All rights reserved.
// *******************************************************************************************************
// Redistribution and use in source and binary forms, with or without  modification, are permitted
// provided that the following conditions are met:
//
// Redistributions of source code must retain the above copyright notice, this list of conditions
// and the following disclaimer.
//
// Redistributions in binary form must reproduce the above copyright notice, this list of conditions
// and the following disclaimer in the documentation and/or other materials provided with the
// distribution.
//
// Neither the name of this project's author nor the names of its contributors may be used to endorse
// or promote products derived from this software without specific prior written permission.
//
// THIS SOFTWARE  IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED
// WARRANTIES,  INCLUDING, BUT  NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY  AND FITNESS FOR
// A PARTICULAR  PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT  HOLDER OR CONTRIBUTORS BE LIABLE
// FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES ( INCLUDING, BUT NOT
// LIMITED TO,  PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,  OR  PROFITS;  OR BUSINESS
// INTERRUPTION ) HOWEVER CAUSED AND ON  ANY THEORY OF  LIABILITY,  WHETHER IN CONTRACT, STRICT LIABILITY,
// OR TORT ( INCLUDING NEGLIGENCE OR OTHERWISE ) ARISING IN  ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN
// IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
// *******************************************************************************************************
// "function type" arguments and block arguments are not handled
// variadic arguments handled: char*/int/float, the rest is converted to void*
// 64-bit only
// NSString.alloc().init().autorelease();
// NSString.stringWithFormat("This is a format string: %@", "and this is a value"); // becomes stringWithFormat:
// NSString.msgSend({ stringWithCString:"javascript string", encoding:kUTF8Encoding });
// NSString['stringWithCString:encoding:']("javascript string", kUTF8Encoding);
// *******************************************************************************************************
Components.utils.import("resource://gre/modules/osfile.jsm");
Components.utils.import("resource://gre/modules/ctypes.jsm");
// *******************************************************************************************************
var EXPORTED_SYMBOLS = ["macosx"];
// *******************************************************************************************************
var __class_proxy = {
executeSelector: function __class_executeSelector(target, name, args) {
    if (args.length && !name.endsWith(":")) name+=":";
    var selector = macosx.libobjc.sel_getUid(name);
    var method = null;
    var is_class_method = (target.__self===target.Class());
    if (is_class_method) method = macosx.libobjc.class_getClassMethod(target.Class(), selector);
    else method = macosx.libobjc.class_getInstanceMethod(target.Class(), selector);
    if (method.isNull()) throw "["+name+"] is not a method to call!";

    var typeEncoding = macosx.libobjc.method_getTypeEncoding(method).readString();
    // TODO: maybe use method_getArgumentType etc, or even NObject.methodForSelector:()?
    var declareTypes = typeEncoding.split(/[nNoOrRV0-9]/).filter(function(v){return v.length;});
    if ((declareTypes.length-3)>args.length) throw "Not enough arguments for "+name+" "+(declareTypes.length-3)+" expected.";
    var declare_function_name = (target.__objc_super?"objc_msgSendSuper":"objc_msgSend");
    var returnType = macosx.ctypeDecode(declareTypes[0]);
    if (!target.__objc_super) { // objc_msgSendSuper doesn't have _fpret pair
        switch (returnType) {
            case ctypes.double:
            case ctypes.float:
                declare_function_name += "_fpret";
                break;
        }
    }
    var function_name = declare_function_name+"_"+declareTypes.join("_");
    if (typeof(macosx.libobjc[function_name]) != "function") {
        var declareArgs = [declare_function_name, ctypes.default_abi, returnType, ctypes.voidptr_t, ctypes.voidptr_t];
        for (var i = 3 ; i < declareTypes.length ; ++i) declareArgs.push(macosx.ctypeDecode(declareTypes[i]));
        macosx.libobjc[function_name] = macosx.DECLARE_VARIADIC_FUNCTION(macosx.libobjc, function_name, macosx.libobjc.lib, declareArgs);
    }
    var callArgs = [(is_class_method?target.__class:(target.__objc_super?target.__objc_super:target.__self)), selector];
    args.forEach(function(v){callArgs.push((v instanceof macosx.__nsobject)?v.__self:v);});
    if (typeof(macosx_debug)=="function") macosx_debug(""+name+" "+typeEncoding+" ==> "+function_name+"("+callArgs.toSource()+")");
    var return_value = macosx.libobjc[function_name].apply(macosx.libobjc, callArgs);
    switch (declareTypes[0][0]) {
        case "@": return return_value.isNull()?null:macosx.__NSObject(return_value);
        case "#": return return_value.isNull()?null:macosx.__NSObject(return_value, return_value);
        default: return return_value;
    }
},
};
// *******************************************************************************************************
var __framework_proxy = {
has: function __framework_has_property(target, name) {
    if (name in target) return true;
    if (name in macosx.classes) return true;
    if (name in macosx.functions) return (macosx.structs[name]._framework.framework_path === target.framework_path);
    if (name in macosx.functions) return (macosx.functions[name]._framework.framework_path === target.framework_path);
    if (name in macosx.enums) return (macosx.enums[name]._framework.framework_path === target.framework_path);
    if (name in macosx.constants) return (macosx.constants[name]._framework.framework_path === target.framework_path);
    return macosx.hasRuntimeClass(name);
},
get: function __framework_get_property(target, name, receiver) {
    if (name in target) return target[name];
    if (name in macosx.functions) { // create function
        var function_obj = macosx.functions[name];
        if (function_obj._framework.framework_path === target.framework_path) {
            var function_definition = function_obj._function_definition;
            var function_arguments = [name, ctypes.default_abi, ctypes.void_t]; // retval void for now, will replace later
            var node = function_definition.firstElementChild;
            while (node) {
                switch (node.nodeName) {
                    // TODO: process modifiers and function_type etc
                    case "arg": function_arguments.push(macosx.ctypeDecode(node.getAttribute("type64")||node.getAttribute("type"))); break;
                    // TODO: process function_type/blocks/etc.
                    case "retval": function_arguments[2] = macosx.ctypeDecode(node.getAttribute("type64")||node.getAttribute("type")); break;
                }
                node = node.nextElementSibling;
            }
            var is_inline = (function_definition.getAttribute("inline")==="true");
            var is_variadic = (function_definition.getAttribute("variadic")==="true");
            // var sentinel = parseInt(function_definition.getAttribute("sentinel"));
            if (is_inline) {
                if (!target.extra_lib) target.extra_lib = ctypes.open(target.extra_lib_path);
                target[name] = macosx.DECLARE_FUNCTION(target, name, target.extra_lib, function_arguments, is_variadic);
            } else {
                if (!target.lib) target.lib = ctypes.open(target.lib_path);
                target[name] = macosx.DECLARE_FUNCTION(target, name, target.lib, function_arguments, is_variadic);
            }
            delete function_obj._function_definition; // we no longer need function declarations
            return target[name];
        }
    }
    if (name in macosx.structs) { // create struct
        var struct_obj = macosx.structs[name];
        if (struct_obj._framework.framework_path === target.framework_path) {
            target[name] = macosx.ctypeDecodeStruct(name, struct_obj._struct_definition);
            //delete struct_obj._struct_definition; // leave this definition alive for struct synonims :-)
            return target[name];
        }
    }
    if (name in macosx.enums) { // parse enum
        var enum_obj = macosx.enums[name];
        if (enum_obj._framework.framework_path === target.framework_path) {
            var node = enum_obj._enum_definition;
            target[name] = parseFloat(node.getAttribute("value64")||node.getAttribute("value"));
            delete enum_obj._enum_definition;
            return target[name];
        }
    }
    if (name in macosx.constants) { // parse constant
        var constant_obj = macosx.constants[name];
        if (constant_obj._framework.framework_path === target.framework_path) {
            var node = constant_obj._constant_definition;
            if (!target.lib) target.lib = ctypes.open(target.lib_path);
            target[name] = target.lib.declare(name, macosx.ctypeDecode(node.getAttribute("type64")||node.getAttribute("type")));
            delete constant_obj._constant_definition;
            return target[name];
        }
    }
    if (name in macosx.classes) return macosx.classes[name]; // classes are not per framework
    if (macosx.hasRuntimeClass(name)) return macosx.classes[name];
},
};
// *******************************************************************************************************
var __macosx = {
frameworks: {}, functions: {}, enums: {}, constants: {}, structs: {}, classes: {}, declared_classes: {}, libobjc: null,
__init_libobjc: function __macosx_init_libobjc() {
    if (!this.libobjc) {
        this.libobjc = {lib:ctypes.open("/usr/lib/libobjc.dylib")};

        // id objc_getClass(const char *name)
        this.libobjc.objc_getClass = this.libobjc.lib.declare("objc_getClass", ctypes.default_abi, ctypes.voidptr_t, ctypes.char.ptr);
        // Class object_getClass(id object)
        this.libobjc.object_getClass = this.libobjc.lib.declare("object_getClass", ctypes.default_abi, ctypes.voidptr_t, ctypes.voidptr_t);

        // SEL sel_getUid(const char *str)
        this.libobjc.sel_getUid = this.libobjc.lib.declare("sel_getUid", ctypes.default_abi, ctypes.voidptr_t, ctypes.char.ptr);
        // const char * method_getTypeEncoding(Method method)
        this.libobjc.method_getTypeEncoding = this.libobjc.lib.declare("method_getTypeEncoding", ctypes.default_abi, ctypes.char.ptr, ctypes.voidptr_t);
        
        // Method class_getInstanceMethod(Class aClass, SEL aSelector)
        this.libobjc.class_getInstanceMethod = this.libobjc.lib.declare("class_getInstanceMethod", ctypes.default_abi, ctypes.voidptr_t, ctypes.voidptr_t, ctypes.voidptr_t);
        // Method class_getClassMethod(Class aClass, SEL aSelector)
        this.libobjc.class_getClassMethod = this.libobjc.lib.declare("class_getClassMethod", ctypes.default_abi, ctypes.voidptr_t, ctypes.voidptr_t, ctypes.voidptr_t);
        // Class class_getSuperclass(Class cls)
        this.libobjc.class_getSuperclass = this.libobjc.lib.declare("class_getSuperclass", ctypes.default_abi, ctypes.voidptr_t, ctypes.voidptr_t);
        
        // id objc_allocateClassPair(Class superclass, const char *name, size_t extraBytes)
        this.libobjc.objc_allocateClassPair = this.libobjc.lib.declare("objc_allocateClassPair", ctypes.default_abi, ctypes.voidptr_t, ctypes.voidptr_t, ctypes.char.ptr, ctypes.size_t);
        // BOOL class_addMethod(Class cls, SEL name, IMP imp, const char *types)
        this.libobjc.class_addMethod = this.libobjc.lib.declare("class_addMethod", ctypes.default_abi, ctypes.bool, ctypes.voidptr_t, ctypes.voidptr_t, ctypes.voidptr_t, ctypes.char.ptr);
        // void objc_registerClassPair(Class cls)
        this.libobjc.objc_registerClassPair = this.libobjc.lib.declare("objc_registerClassPair", ctypes.default_abi, ctypes.void_t, ctypes.voidptr_t);
        
        // struct objc_super { id receiver; Class class; }
        this.libobjc.objc_super = ctypes.StructType("objc_super", [{"receiver":ctypes.voidptr_t}, {"class":ctypes.voidptr_t}]);
    }
},
__nsobject: function __macosx__nsobject__internal(self, self_class) {
    this.__self = self;
    this.__class = self_class;
    this.__noSuchMethod__ = function(name, args) { return __class_proxy.executeSelector(this, name, args); };
    this.self = function() { return this.__self; }
    this.Class = function() { if (!this.__class) this.__class = macosx.libobjc.object_getClass(this.__self); return this.__class; };
    this.msgSend = function(arg) {
        var selector = ""; var args = []; for (var part in arg) { selector+=part+":"; args.push(arg[part]); }
        if (!selector.length) throw "Invalid msgSend({...}) arguments...";
        return __class_proxy.executeSelector(this, selector, args);
    };
},
__nsinterface: function __macosx__nsinterface__internal(class_name, inherit_from, protocol_array) {
    this.DECLARE_INTERFACE_END = function() { macosx.libobjc.objc_registerClassPair(this.__self); };
    this.INSTANCE_METHOD = function(ret_type, name, function_body) {
        var function_arguments = [ctypes.voidptr_t, ctypes.voidptr_t];
        var args = [ret_type, "@", ":"];
        var method_name = name;
        if (typeof(method_name)!="string") {
            method_name = "";
            for (var part in name) {
                method_name+=part+":";
                args.push(name[part]);
                function_arguments.push(macosx.ctypeDecode(name[part]));
            }
            if (!method_name.length) throw "Invalid method definition: string or dictionary is expected";
        }
        var function_type = ctypes.FunctionType(ctypes.default_abi, macosx.ctypeDecode(args[0]), function_arguments);
        var function_type_string = "V"+args[0]+(args.length-1)*8; // 64-bit only
        for (var i = 1 ; i < args.length ; ++i) function_type_string+=args[i]+(i-1)*8;
        var method = {
            function_selector:macosx.libobjc.sel_getUid(method_name),
            function_type:function_type,
            function_body:function_body,
            function_impl:function_type.ptr(function (object, __sel) { // instance method only!
                var __this = macosx.__NSObject(object);
                __this.__cmd = __sel;
                __this.__super = macosx.__NSObject(object, macosx.libobjc.class_getSuperclass(__this.Class()));
                __this.__super.__objc_super_object = new macosx.libobjc.objc_super;
                __this.__super.__objc_super_object["receiver"] = __this.__super.__self;
                __this.__super.__objc_super_object["class"] = __this.__super.__class;
                __this.__super.__objc_super = __this.__super.__objc_super_object.address();
                var __args = [];
                for (var i = 2 ; i < arguments.length ; ++i) __args.push((args[i+1]=="@")?macosx.__NSObject(arguments[i]):arguments[i]);
                if (typeof(macosx_debug)=="function") { macosx_debug(method_name+" "+function_type_string+" ("+__args.toSource()+")"); };
                var return_value = function_body.apply(__this, __args);
                if (return_value instanceof macosx.__nsobject) return_value = return_value.__self;
                return return_value;
            }),
        };
        if (!macosx.libobjc.class_addMethod(this.__self, method.function_selector, method.function_impl, function_type_string))
            throw "Failed to declare instance method "+method_name;
        this.__methods[method_name] = method; // store all objects so runtime can call them!
    };
    this.__self = null;
    this.__name = class_name;
    this.__superclass = inherit_from||macosx.NSObject;
    this.__methods = {};
    this.id = "@";
    this.class_t = "#";
    this.void_t = "v";
    this.SEL = ":";
    this.char = "c";
    this.int = "i";
    this.short = "s";
    this.long = "l";
    this.long_long = "q";
    this.unsigned_char = "C";
    this.unsigned_int = "I";
    this.unsigned_short = "S"; // An unsigned short
    this.unsigned_long = "L"; // An unsigned long
    this.unsigned_long_long = "Q"; // An unsigned long long
    this.float = "f"; // A float
    this.double = "d"; // A double
    this.bool = "B"; // A C++ bool or a C99 _Bool
    this.string = "*"; // A character string (char *)
    
    this.__self = macosx.libobjc.objc_allocateClassPair(this.__superclass.__self, this.__name, 0);
},
ctypeDecodeArray: function __macosx_ctype_decode_array(str) {
    if (str[0] == "[") {
        var numbers = "0123456789";
        var stop_count_str = false;
        var count_str = "";
        var the_rest_starts_at = -1;
        var closing_index = 1;
        for (var i = 1 ; i < str.length ; ++i) {
            if (!stop_count_str) {
                if (numbers.indexOf(str[i]) >= 0) {
                    count_str+=str[i];
                    continue;
                }
                stop_count_str = true;
                the_rest_starts_at = i;
            }
            switch (str[i]) {
                case "[": ++closing_index; break;
                case "]": --closing_index; if (closing_index == 0) return ctypes.ArrayType(this.ctypeDecode(str.substring(the_rest_starts_at, i)), parseInt(count_str)); break;
            }
        }
    }
    throw "Invalid array definition: "+str;
},
ctypeDecodeStruct: function __macosx_ctype_decode_struct(name, str) {
    var current_field = "";
    var current_data_start = 0;
    var def_object = {};
    for (var i = 0 ; i < str.length ; ++i) {
        switch (str[i]) {
            case "\"":
                if (current_field.length) {
                    def_object[current_field] = str.substr(current_data_start, i-current_data_start);
                }
                var nextQuote = str.indexOf("\"", i+1);
                if (nextQuote>i+1) {
                    current_field=str.substr(i+1, nextQuote-i-1);
                    i=nextQuote;
                    current_data_start=i+1;
                } else
                    throw "Invalid struct definition: "+str;
                break;
            case "{": case "(": // skip nested struct, ctypeDecode will take care of it
                var braces_count = 1;
                for (var j = i+1 ; j < str.length ; ++j) {
                    switch (str[j]) {
                        case "{": case "(": ++braces_count; break;
                        case "}": case ")": --braces_count;
                            if (!braces_count) i=j; // last brace
                            break;
                    }
                    if (i===j) break;
                }
                break;
        }
    }
    def_object[current_field] = str.substr(current_data_start);
    var struct_fields = [];
    for (var field in def_object) {
        var field_def = {};
        field_def[field] = macosx.ctypeDecode(def_object[field]);
        struct_fields.push(field_def);
    }
    var declared_struct = ctypes.StructType(name, struct_fields);
    if (typeof(macosx_debug)=="function") macosx_debug("{"+name+"="+str+"} ==> "+declared_struct.toSource());
    return declared_struct;
},
ctypeDecode: function __macosx_ctype_decode(str) {
    switch (str[0]) {
        case "c": return ctypes.char; // A char
        case "i": return ctypes.int; // An int
        case "s": return ctypes.short; // A short
        case "l": return ctypes.int; // A long: l is treated as a 32-bit quantity on 64-bit programs. (defined as ctypes.int because ctypes will treat ctypes.long as a 64-bit integer)
        case "q": return ctypes.long_long; // A long long
        case "C": return ctypes.unsigned_char; // An unsigned char
        case "I": return ctypes.unsigned_int; // An unsigned int
        case "S": return ctypes.unsigned_short; // An unsigned short
        case "L": return ctypes.unsigned_long; // An unsigned long
        case "Q": return ctypes.unsigned_long_long; // An unsigned long long
        case "f": return ctypes.float; // A float
        case "d": return ctypes.double; // A double
        case "B": return ctypes.bool; // A C++ bool or a C99 _Bool
        case "v": return ctypes.void_t; // A void
        case "*": return ctypes.char.ptr; // A character string (char *)
        case "@":
            if (str==="@?") return ctypes.voidptr_t; // TODO: block, should be function type?
            else return ctypes.voidptr_t; // An object (whether statically typed or typed id)
        case "#": return ctypes.voidptr_t; // A class object (Class)
        case ":": return ctypes.voidptr_t; // A method selector (SEL)
        case "[": return this.ctypeDecodeArray(str); // "[array type]": ;// An array
        case "{": // "{name=type...}": ; // A structure
            var struct_name = str.substr(1).split("=", 1);
            var struct_def = macosx[struct_name];
            if (!struct_def) struct_def = ctypes.StructType(struct_name); // opaque, do not call ctypeDecodeStruct() here
            return struct_def;
        // TODO: implement these types
        case "(": throw "macosx: union type not supported yet"; //"(name=type...)": ;// A union
        case "b": throw "macosx: bit fields not supported yet"; // "bnum": ;// A bit field of num bits
        case "^":
            switch (str[1]) {
                case "v": // void *
                case "?": // function *, TODO: should be ctypes.FunctionType
                case "[": // array *, stop parsing, TODO: later
                case "{": // struct *, TODO: later
                case "(": // union *, TODO: later
                    return ctypes.voidptr_t;
                default:
                    return ctypes.PointerType(macosx.ctypeDecode(str.substr(1))); // ^type = A pointer to type
            }
        case "?" : return ctypes.voidptr_t; // An unknown type (among other things, this code is used for function pointers)
        case "n": // in
        case "N": // inout
        case "o": // out
        case "O": // bycopy
        case "r": // const
        case "R": // byref
        case "V": // oneway
            return macosx.ctypeDecode(str.substr(1));
        default: return ctypes.voidptr_t;
    }
},
DECLARE_FUNCTION: function __macosx_declare_function(target, name, lib, function_arguments, is_variadic) {
    if (is_variadic) return this.DECLARE_VARIADIC_FUNCTION(target, name, lib, function_arguments);

    var __hidden_name = "__"+name;
    target[__hidden_name] = lib.declare.apply(lib, function_arguments);
    var foo = function __function() {
        if ((function_arguments.length-3)>arguments.length) throw "Not enough arguments for "+name+" "+(function_arguments.length-3)+" expected.";
        var __name = "__"+name;
        var call_arguments = [];
        for (var i = 0 ; i < arguments.length ; ++i) {
            var argument = arguments[i];
            if (argument instanceof macosx.__nsobject) argument = argument.__self;
            call_arguments.push(argument);
        }
        return target[__name].apply(target, call_arguments);
    }
    return foo;
},
DECLARE_VARIADIC_FUNCTION: function __macosx_declare_variadic_function(target, name, lib, function_arguments) {
    var foo = function __variadic_function() {
        if ((function_arguments.length-3)>arguments.length) throw "Not enough arguments for "+name+" "+(function_arguments.length-3)+" expected.";

        var __name = "__"+name+"+";
        switch (function_arguments[2]) { // function return type
            case ctypes.void_t: __name+="v"; break;
            case ctypes.bool: __name+="B"; break;
            case ctypes.char.ptr: __name+="s"; break;
            case ctypes.int: case ctypes.short: case ctypes.long_long: case ctypes.unsigned_int: case ctypes.unsigned_long_long: __name+="i"; break;
            case ctypes.float: case ctypes.double: __name+="f"; break;
            default: __name+="p"; break;
        }
        for (var i = function_arguments.length-3 ; i < arguments.length ; ++i) {
            switch (typeof(arguments[i])) {
                case "boolean": __name+="_B"; break;
                case "string": __name+="_s"; break;
                case "number": __name+=((parseFloat(arguments[i])===parseInt(arguments[i]))?"_i":"_f"); break;
                default: __name+="_p"; break;
            }
        }
        if (typeof(target[__name]) != "function") {
            var declare_arguments = Array.prototype.slice.call(function_arguments);
            for (var i = declare_arguments.length-3 ; i < arguments.length ; ++i) {
                switch (typeof(arguments[i])) {
                    case "boolean": declare_arguments.push(ctypes.bool); break;
                    case "string": declare_arguments.push(ctypes.char.ptr); break;
                    case "number": declare_arguments.push((parseFloat(arguments[i])===parseInt(arguments[i]))?ctypes.long_long:ctypes.double); break;
                    default: declare_arguments.push(ctypes.voidptr_t); break;
                }
            }
            target[__name] = lib.declare.apply(lib, declare_arguments);
        }
        var call_arguments = [];
        for (var i = 0 ; i < arguments.length ; ++i) {
            var argument = arguments[i];
            if (argument instanceof macosx.__nsobject) argument = argument.__self;
            call_arguments.push(argument);
        }
        if (typeof(macosx_debug)=="function") {
            macosx_debug(__name+" ==> "+target[__name].toSource());
            macosx_debug(__name+"("+call_arguments.toSource()+")");
        }
        return target[__name].apply(target, call_arguments);
    };
    return foo;
},
DECLARE_INTERFACE: function __macosx_declare_interface(class_superclass_name, protocol_array) {
    if (!class_superclass_name) throw "Class name required in the interface declaration";
    var superclass_ptr = null;
    var class_name = null;
    if (typeof(class_superclass_name)=="string") {
        var parts = class_superclass_name.split(":");
        class_name = parts[0];
        superclass_ptr = parts[1];
    } else if (Array.isArray(class_superclass_name)) {
        class_name=class_superclass_name[0];
        superclass_ptr=class_superclass_name[1];
        // TODO: the rest may be considered protocol list
    } else {
        for (var common_name in class_superclass_name) {
            if (typeof(common_name)=="string") {
                class_name = common_name;
                superclass_ptr = class_superclass_name[common_name];
                // TODO: the rest may be considered a protocol list
            }
            break;
        }
    }
    if (typeof(superclass_ptr)=="string") superclass_ptr=macosx[superclass_ptr];
    if (!class_name) throw "Class name required in the interface declaration";
    var existing_class = this.declared_classes[class_name];
    if (existing_class) return existing_class;

    this.declared_classes[class_name] = new this.__nsinterface(class_name, superclass_ptr, protocol_array);
    return this.declared_classes[class_name];
},
__js_to_xml: function __macosx_converter_js_to_xml(object, indent) {
    var ret_xml = "";
    if (!indent) { indent = 0; ret_xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n<plist version=\"1.0\">\n"; }
    var _indent = indent;
    var indent_str = ""; while(_indent) { indent_str += "  "; --_indent; }
    var typeof_object = typeof(object);
    if (typeof_object != "undefined") {
        if (typeof_object == "object") { if (Array.isArray(object)) typeof_object = "array"; else if (object instanceof Date) typeof_object = "date"; }
        switch (typeof_object) {
            case "boolean": ret_xml += indent_str+(object?"<true />":"<false />\n"); break;
            case "number": ret_xml += indent_str+((parseFloat(object) === parseInt(object))?"<integer>"+object+"</integer>\n":"<real>"+object+"</real>\n"); break;
            case "date": ret_xml += indent_str+"<date>"+object.toISOString().substr(0, 19)+"Z</date>\n"; break;
            case "array":
                ret_xml += indent_str+"<array>\n";
                for (var i = 0 ; i < object.length ; ++i) ret_xml += this.__js_to_xml(object[i], indent+1);
                ret_xml += indent_str+"</array>\n";
                break;
            case "object": // assume it is dictionary!
                ret_xml += indent_str+"<dict>\n";
                for (var name in object) {
                    ret_xml += indent_str+"  <key><![CDATA["+name+"]]></key>\n";
                    ret_xml += this.__js_to_xml(object[name], indent+1);
                }
                ret_xml += indent_str+"</dict>\n";
                break;
            case "string": default: ret_xml += indent_str+"<string><![CDATA["+object+"]]></string>\n"; break;
        }
    }
    if (!indent) ret_xml += "</plist>";
    return ret_xml;
},
__NSObjectFromJSObject: function __macosx_nsobject_from_jsobject(value, mutable) {
    var xml = this.__js_to_xml(value);
    var error = ctypes.voidptr_t(0);
    with (macosx) {
        var format = ctypes.unsigned_long_long(NSPropertyListXMLFormat_v1_0);
        var data = NSData["dataWithBytes:length:"](ctypes.char.array()(xml), xml.length);
        return NSPropertyListSerialization.msgSend({ propertyListWithData:data, options:(mutable?NSPropertyListMutableContainersAndLeaves:NSPropertyListImmutable), format:format.address(), error:error.address() });
    }
},
__xml_parse_string: function __macosx_parse_xml_string(xml_string) {
    try {
        if (!this.__DOMparser) this.__DOMparser = Components.classes["@mozilla.org/xmlextras/domparser;1"].createInstance(Components.interfaces.nsIDOMParser);
        return this.__DOMparser.parseFromString(xml_string, "text/xml").getElementsByTagName("plist").item(0);
    }
    catch (e) { }
    return "";
},
__js_from_xml: function __macosx_converter_js_from_xml(xml) {
    if (!xml) return null;
    var children = xml.children;
    switch(xml.nodeName) {
        case "plist":
            if (children.length > 1) {
                var plist_array = [];
                for(var i = 0 ; i < children.length ; ++i) plist_array.push(this.__js_from_xml(children[i]));
                return plist_array;
            } else
                return this.__js_from_xml(children[0]);
            break;
        case "dict":
            var dictionary = { };
            var key_name = "";
            for(var i = 0 ; i < children.length ; ++i) {
                var child = children[i];
                if (child.nodeName == "key") key_name = child.textContent;
                else dictionary[key_name] = this.__js_from_xml(child);
            }
            return dictionary;
        case "array":
            var standard_array = [];
            for(var i = 0 ; i < children.length ; ++i) standard_array.push(this.__js_from_xml(children[i]));
            return standard_array;
        case "string": return xml.textContent;
        case "date": return new Date(Date.parse(xml.textContent));
        case "integer": return parseInt(xml.textContent, 10);
        case "real": return parseFloat(xml.textContent);
        case "true": return true;
        case "false": return false;
        case "data":
        default: return xml.textContent;
    };
},
__NSObjectToJSObject: function __macosx_nsobject_to_jsobject(object) {
    var error = ctypes.voidptr_t(0);
    with (macosx) {
        var format = ctypes.unsigned_long_long(NSPropertyListXMLFormat_v1_0);
        var data = NSPropertyListSerialization.msgSend({ dataWithPropertyList:object, format:format, options:0, error:error.address() });
        var contents = ctypes.cast(data.bytes(), ctypes.char.array(data.length()).ptr).contents;
        var xml = "";
        for (var i = 0 ; i < contents.length ; ++i) xml+=String.fromCharCode(contents[i]);
        return this.__js_from_xml(this.__xml_parse_string(xml));
    }
},
__NSString: function __macosx_ns_string(value) { return macosx.NSString.stringWithUTF8String(String(value)); },
__NSObject: function __macosx_ns_object(self, self_class) { return new Proxy(new macosx.__nsobject(self, self_class), __class_proxy); },
hasRuntimeClass: function __macosx_has_runtime_class(name) {
    if (name in this.classes) return true;

    if (!this.libobjc) this.__init_libobjc();
    var __object = this.libobjc.objc_getClass(name);
    if (!__object.isNull()) {
        this.classes[name] = macosx.__NSObject(__object, __object);
        return true;
    }
    return false;
},
loadBridgeSupport: function __macosx_load_bridge_support(framework, include_dependencies) {
    try {
        var req = Components.Constructor("@mozilla.org/xmlextras/xmlhttprequest;1")();
        req.open("GET", "file://"+framework.bridge_support_path, false); req.send();
        // allow GC clean this XML since we retain all the relevant information
        var bridge_support = req.responseXML;
        if (bridge_support) {
            if ((typeof(include_dependencies)==="undefined") || include_dependencies) {
                var dependencies = bridge_support.getElementsByTagName("depends_on");
                for (var i = 0 ; i < dependencies.length ; ++i) {
                    var depends_on = dependencies[i];
                    var depends_on_path = depends_on.getAttribute("path");
                    this.importFramework(depends_on_path, include_dependencies);
                }
            }
            var functions = bridge_support.getElementsByTagName("function");
            for (var i = 0 ; i < functions.length ; ++i) {
                var framework_function = functions[i];
                var function_name = framework_function.getAttribute("name");
                this.functions[function_name] = {_function_definition:framework_function,_framework:framework};
            }
            var constants = bridge_support.getElementsByTagName("constant");
            for (var i = 0 ; i < constants.length ; ++i) {
                var framework_constant = constants[i];
                var constant_name = framework_constant.getAttribute("name");
                this.constants[constant_name] = {_constant_definition:framework_constant,_framework:framework};
            }
            var enums = bridge_support.getElementsByTagName("enum");
            for (var i = 0 ; i < enums.length ; ++i) {
                var framework_enum = enums[i];
                var enum_name = framework_enum.getAttribute("name");
                this.enums[enum_name] = {_enum_definition:framework_enum,_framework:framework};
            }
            var structs = bridge_support.getElementsByTagName("struct");
            for (var i = 0 ; i < structs.length ; ++i) {
                var framework_struct = structs[i];
                var struct_name = framework_struct.getAttribute("name");
                var struct_def = (framework_struct.getAttribute("type64")||framework_struct.getAttribute("type"));
                struct_def = struct_def.substr(1, struct_def.length-1);
                var index = struct_def.indexOf("=");
                if (index >= 0) {
                    var struct_typedef_name = struct_def.substr(0, index);
                    var struct_typedef_fields = struct_def.substr(index+1, struct_def.length-index-2);
                    this.structs[struct_typedef_name] = {_struct_definition:struct_typedef_fields,_framework:framework};
                    this.structs[struct_name] = this.structs[struct_typedef_name];
                }
            }
        }
        return true;
    }
    catch (e) { }
    return false;
},
importFramework: function __macosx_import_framework(name_or_path, include_dependencies, bridge_support_path, extra_lib_path) {
    var file_name = OS.Path.basename(name_or_path);
    var name = file_name.split(".")[0];
    var path = OS.Path.dirname(name_or_path);
    if (path===".") path="/System/Library/Frameworks";
    if (name && !this.frameworks[name]) {
        var framework = {lib: null, extra_lib: null};
        framework.framework_path = path+"/"+((file_name===name)?(name+".framework"):file_name);
        framework.lib_path = framework.framework_path+"/"+name;
        framework.bridge_support_path = bridge_support_path||(framework.framework_path+"/Resources/BridgeSupport/"+name+".bridgesupport");
        framework.extra_lib_path = extra_lib_path||(framework.framework_path+"/Resources/BridgeSupport/"+name+".dylib");
        this.frameworks[name] = new Proxy(framework, __framework_proxy);
        return this.loadBridgeSupport(this.frameworks[name], include_dependencies);
    }
},
};
// *******************************************************************************************************
var __macosx_proxy = {
has: function __macosx_has_property(target, name) {
    if (name in target) return true;
    if (name in target.frameworks) { target[name] = target.frameworks[name]; return true; }
    if (name in target.classes) return true;
    if (name in target.functions) return true;
    if (name in target.enums) return true;
    if (name in target.constants) return true;
    if (name in target.structs) return true;
    return target.hasRuntimeClass(name); // should create item in target.classes array!
},
get: function __macosx_get_property(target, name, receiver) {
    if (name in target) return target[name];
    if (name in target.frameworks) return target.frameworks[name];
    if (name in target.structs) return target.structs[name]._framework[name];
    if (name in target.functions) return target.functions[name]._framework[name];
    if (name in target.enums) return target.enums[name]._framework[name];
    if (name in target.constants) return target.constants[name]._framework[name];
    if (name in target.classes) return target.classes[name]; // classes are not per framework
    if (target.hasRuntimeClass(name)) return target.classes[name];
},
};
// *******************************************************************************************************
var macosx = new Proxy(__macosx, __macosx_proxy);
