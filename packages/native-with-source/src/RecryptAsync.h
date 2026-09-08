/*
 Source File : RecryptAsync.h


 Copyright 2026 Julian Hille MuhammaraJS

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.

 */
#pragma once

#include "nodes.h"

#include "EPDFVersion.h"
#include "PDFWriter.h"

#include <string>

// Shared by the synchronous recrypt() and the asynchronous recryptAsync(), so
// both accept exactly the same options and reject the same inputs.
// Returns false when an exception has already been thrown on the isolate.
bool ParseRecryptArguments(v8::Isolate* isolate,
                           const v8::FunctionCallbackInfo<v8::Value>& args,
                           EPDFVersion& outPDFVersion,
                           PDFCreationSettings& outCreationSettings,
                           LogConfiguration& outLogConfiguration,
                           std::string& outOriginalPassword);

// The message both entry points use when PDFWriter reports a failure, so the
// rejection text of recryptAsync() matches the throw of recrypt().
extern const char* const scRecryptFailureMessage;

METHOD_RETURN_TYPE RecryptAsync(const ARGS_TYPE& args);
