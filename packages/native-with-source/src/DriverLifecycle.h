#pragma once

#include <memory>
#include <vector>

class DriverLifecycleState
{
public:
    DriverLifecycleState() : mActive(true) {}

    bool IsActive() const
    {
        if(!mActive)
            return false;
        for(std::vector<std::shared_ptr<DriverLifecycleState> >::const_iterator it = mOwners.begin(); it != mOwners.end(); ++it)
        {
            if(!(*it)->IsActive())
                return false;
        }
        return true;
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
    std::vector<std::shared_ptr<DriverLifecycleState> > mOwners;
};

typedef std::shared_ptr<DriverLifecycleState> DriverLifecycle;
