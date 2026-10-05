/*
   Source File : InputStreamSkipperStream.cpp


   Copyright 2011 Gal Kahana PDFWriter

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
#include "InputStreamSkipperStream.h"

#include <string.h>

InputStreamSkipperStream::InputStreamSkipperStream(void)
{
	mStream = NULL;
	mAmountRead = 0;
	mReadAhead = NULL;
	mReadAheadSize = mReadAheadStart = mReadAheadEnd = 0;
}

InputStreamSkipperStream::~InputStreamSkipperStream(void)
{
	if(mStream != NULL)
		delete mStream;
	delete[] mReadAhead;
}

InputStreamSkipperStream::InputStreamSkipperStream(IByteReader* inSourceStream)
{
	mReadAhead = NULL;
	mReadAheadSize = 0;
	Assign(inSourceStream);
}


void InputStreamSkipperStream::Assign(IByteReader* inSourceStream)
{
	mStream = inSourceStream;
	mAmountRead = 0;
	mReadAheadStart = mReadAheadEnd = 0;
}

void InputStreamSkipperStream::EnableReadAhead(IOBasicTypes::LongBufferSizeType inSize)
{
	delete[] mReadAhead;
	mReadAhead = inSize > 0 ? new IOBasicTypes::Byte[inSize] : NULL;
	mReadAheadSize = inSize;
	mReadAheadStart = mReadAheadEnd = 0;
}

IOBasicTypes::LongBufferSizeType InputStreamSkipperStream::Read(IOBasicTypes::Byte* inBuffer,IOBasicTypes::LongBufferSizeType inBufferSize)
{
	if(!mReadAhead)
	{
		IOBasicTypes::LongBufferSizeType readThisTime = mStream->Read(inBuffer,inBufferSize);
		mAmountRead+=readThisTime;
		return readThisTime;
	}

	IOBasicTypes::LongBufferSizeType delivered = 0;
	while(delivered < inBufferSize)
	{
		if(mReadAheadStart == mReadAheadEnd)
		{
			if(!mStream || !mStream->NotEnded())
				break;
			mReadAheadStart = 0;
			mReadAheadEnd = mStream->Read(mReadAhead,mReadAheadSize);
			if(mReadAheadEnd == 0)
				break;
		}
		IOBasicTypes::LongBufferSizeType available = mReadAheadEnd - mReadAheadStart;
		IOBasicTypes::LongBufferSizeType amount = inBufferSize - delivered < available ? inBufferSize - delivered : available;
		memcpy(inBuffer + delivered,mReadAhead + mReadAheadStart,amount);
		mReadAheadStart += amount;
		delivered += amount;
	}
	mAmountRead+=delivered;
	return delivered;
}

bool InputStreamSkipperStream::NotEnded()
{
	if(mReadAheadStart != mReadAheadEnd)
		return true;
	return mStream ? mStream->NotEnded() : false;
}


bool InputStreamSkipperStream::CanSkipTo(IOBasicTypes::LongFilePositionType inPositionInStream)
{
	return mAmountRead <= inPositionInStream;
}

void InputStreamSkipperStream::SkipTo(IOBasicTypes::LongFilePositionType inPositionInStream)
{
	if(!CanSkipTo(inPositionInStream))
		return;

	SkipBy(inPositionInStream-mAmountRead);
}

// will skip by, or hit EOF
void InputStreamSkipperStream::SkipBy(IOBasicTypes::LongFilePositionType inAmountToSkipBy)
{
	IOBasicTypes::Byte buffer;

	while(NotEnded() && inAmountToSkipBy>0)
	{
		Read(&buffer,1);
		--inAmountToSkipBy;
	}

}

void InputStreamSkipperStream::Reset()
{
	mAmountRead = 0;
	// the source moved; what was read ahead is no longer next
	mReadAheadStart = mReadAheadEnd = 0;
}

IOBasicTypes::LongFilePositionType InputStreamSkipperStream::GetCurrentPosition()
{
	return mAmountRead;
}