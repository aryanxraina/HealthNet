from fastapi import APIRouter, Depends

from auth import current_user
from risk import Profile, assess

router = APIRouter(prefix="/risk", tags=["risk"])


@router.post("/assessment")
def risk_assessment(profile: Profile, uid: str = Depends(current_user)):
    # Calculated on the fly: health data is neither stored nor logged here
    return assess(profile)
