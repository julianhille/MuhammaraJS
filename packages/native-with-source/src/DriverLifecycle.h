#pragma once

#include <cstddef>
#include <memory>
#include <string>
#include <vector>

class DriverLifecycleState
{
public:
    // The name completes the error thrown after the lifecycle ends, as in
    // "PDF writer has ended".
    explicit DriverLifecycleState(const std::string& inName = std::string())
        : mActive(true), mName(inName) {}

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

    const std::string& GetName() const
    {
        return mName;
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
    std::string mName;
    std::vector<std::shared_ptr<DriverLifecycleState> > mOwners;
};

typedef std::shared_ptr<DriverLifecycleState> DriverLifecycle;
