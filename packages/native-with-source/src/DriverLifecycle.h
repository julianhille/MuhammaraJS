#pragma once

#include <cstddef>
#include <memory>
#include <string>
#include <vector>

class DriverLifecycleState
{
public:
    // The error thrown when an object tied to this lifecycle is used after
    // it ended, such as "PDF writer has ended".
    explicit DriverLifecycleState(
        const std::string& inEndedMessage = std::string())
        : mActive(true), mEndedMessage(inEndedMessage) {}

    bool IsActive() const
    {
        return EndedState() == NULL;
    }

    // The first ended lifecycle, this one or an owner, or NULL while active.
    const DriverLifecycleState* EndedState() const
    {
        if(!mActive)
            return this;
        for(std::vector<std::shared_ptr<DriverLifecycleState> >::const_iterator it = mOwners.begin(); it != mOwners.end(); ++it)
        {
            const DriverLifecycleState* ended = (*it)->EndedState();
            if(ended)
                return ended;
        }
        return NULL;
    }

    const std::string& GetEndedMessage() const
    {
        return mEndedMessage;
    }

    void End()
    {
        mActive = false;
    }

    void SetOwner(const std::shared_ptr<DriverLifecycleState>& inOwner)
    {
        mOwners.clear();
        AddOwner(inOwner);
    }

    void AddOwner(const std::shared_ptr<DriverLifecycleState>& inOwner)
    {
        if(inOwner)
            mOwners.push_back(inOwner);
    }

private:
    bool mActive;
    std::string mEndedMessage;
    std::vector<std::shared_ptr<DriverLifecycleState> > mOwners;
};

typedef std::shared_ptr<DriverLifecycleState> DriverLifecycle;
