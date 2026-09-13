#pragma once

#include <memory>

class DriverLifecycleState
{
public:
    DriverLifecycleState() : mActive(true) {}

    bool IsActive() const
    {
        return mActive && (!mOwner || mOwner->IsActive());
    }

    void End()
    {
        mActive = false;
    }

    void SetOwner(const std::shared_ptr<DriverLifecycleState>& inOwner)
    {
        mOwner = inOwner;
    }

private:
    bool mActive;
    std::shared_ptr<DriverLifecycleState> mOwner;
};

typedef std::shared_ptr<DriverLifecycleState> DriverLifecycle;
