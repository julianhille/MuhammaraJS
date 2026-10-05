/*
 Source File : InputDCTDecodeStream.h
 
 
 Copyright 2012 Gal Kahana PDFWriter
 
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

#ifndef PDFHUMMUS_NO_DCT

#include "EStatusCode.h"
#include "IByteReader.h"
#include "jpeglib.h"

#include <setjmp.h>

// MuhammaraJS: libjpeg reports a fatal error through error_exit, which must
// not return. It used to throw a C++ exception through libjpeg's C frames,
// which aborts the process where C code has no unwind tables (riscv64) and
// which MSVC's /EHsc may not catch. error_exit now longjmps to `jump`, as
// libjpeg's own example does.
struct HummusJPGErrorManager
{
    struct jpeg_error_mgr pub;
    jmp_buf jump;
};

class InputDCTDecodeStream : public IByteReader
{
public:
    InputDCTDecodeStream();
    virtual ~InputDCTDecodeStream();
    
	// Note that assigning passes ownership on the stream, use Assign(NULL) to remove ownership
    InputDCTDecodeStream(IByteReader* inSourceReader);
    
 	// Assigning passes ownership of the input stream to the decoder stream.
	// if you don't care for that, then after finishing with the decode, Assign(NULL).
    void Assign(IByteReader* inSourceReader);
    
	// IByteReader implementation. note that "inBufferSize" determines how many
	// bytes will be placed in the Buffer...not how many are actually read from the underlying
	// encoded stream. got it?!
	virtual IOBasicTypes::LongBufferSizeType Read(IOBasicTypes::Byte* inBuffer,IOBasicTypes::LongBufferSizeType inBufferSize);
    
	virtual bool NotEnded();
    
private:
    jpeg_decompress_struct mJPGState;
    HummusJPGErrorManager mJPGError;

    IByteReader* mStream;
    JSAMPARRAY mSamplesBuffer;
    bool mIsDecoding;
    IOBasicTypes::LongBufferSizeType mIndexInRow;
    IOBasicTypes::LongBufferSizeType mCurrentSampleRow;
    IOBasicTypes::LongBufferSizeType mTotalSampleRows;
    bool mIsHeaderRead;
    
    void InitializeDecodingState();
    PDFHummus::EStatusCode StartRead();
    void FinalizeDecoding();
    IOBasicTypes::Byte* CopySamplesArrayToBuffer(IOBasicTypes::Byte* inBuffer, IOBasicTypes::LongBufferSizeType inBufferSize);

};

#endif