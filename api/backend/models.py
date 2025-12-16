# api/backend/models.py
from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    Text,
    DateTime,
)
from db import Base


class FrameRaw(Base):
    __tablename__ = "frames_raw"

    id = Column(Integer, primary_key=True, index=True)
    frame_id = Column(String, unique=True, index=True, nullable=False)
    frame_url = Column(Text, nullable=True)

    lon = Column(Float, nullable=False)
    lat = Column(Float, nullable=False)

    road_id = Column(String, nullable=True)
    road_name = Column(Text, nullable=True)
    clazz = Column("class", String, nullable=True)  # имя столбца 'class'
    object_type = Column(String, nullable=True)
    hgv_access = Column(String, nullable=True)
    weight_limit_tons = Column(Float, nullable=True)
    axle_load_tons = Column(Float, nullable=True)
    time_windows = Column(Text, nullable=True)      # JSON-строка
    valid_from = Column(String, nullable=True)
    valid_to = Column(String, nullable=True)
    direction = Column(String, nullable=True)

    source_type = Column(String, nullable=True)
    source_name = Column(String, nullable=True)

    comment_raw = Column(Text, nullable=True)
    comment_human = Column(Text, nullable=True)

    priority = Column(Integer, nullable=True)
    tags = Column(Text, nullable=True)              # JSON-строка

    frame_row_id_raw = Column(String, nullable=True)
    frame_status_raw = Column(String, nullable=True)
    frame_error_raw = Column(Text, nullable=True)
    frame_state = Column(String, nullable=True)

    frame_first_seen = Column(String, nullable=True)
    frame_last_seen = Column(String, nullable=True)
    frame_is_active = Column(Boolean, default=True)
    frame_change_type = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FrameManual(Base):
    __tablename__ = "frames_manual"

    id = Column(Integer, primary_key=True, index=True)
    frame_id = Column(String, index=True, nullable=False)

    lon_override = Column(Float, nullable=True)
    lat_override = Column(Float, nullable=True)

    road_id_override = Column(String, nullable=True)
    road_name_override = Column(Text, nullable=True)
    clazz_override = Column("class_override", String, nullable=True)

    hgv_access_override = Column(String, nullable=True)
    weight_limit_tons_override = Column(Float, nullable=True)
    axle_load_tons_override = Column(Float, nullable=True)
    time_windows_override = Column(Text, nullable=True)
    valid_from_override = Column(String, nullable=True)
    valid_to_override = Column(String, nullable=True)
    direction_override = Column(String, nullable=True)
    frame_state_override = Column(String, nullable=True)

    comment_admin = Column(Text, nullable=True)
    tags_admin = Column(Text, nullable=True)

    is_deleted_by_admin = Column(Boolean, default=False)
    manual_only = Column(Boolean, default=False)
    needs_review = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FrameSuggestion(Base):
    __tablename__ = "frame_suggestions"

    id = Column(Integer, primary_key=True, index=True)

    frame_id = Column(String, index=True, nullable=True)  # NULL для новой рамки
    type = Column(String, nullable=False)                  # 'change_existing' / 'new_frame'

    suggested_lon = Column(Float, nullable=True)
    suggested_lat = Column(Float, nullable=True)
    suggested_weight_limit_tons = Column(Float, nullable=True)
    suggested_axle_load_tons = Column(Float, nullable=True)
    suggested_direction = Column(String, nullable=True)
    suggested_frame_state = Column(String, nullable=True)

    comment_driver = Column(Text, nullable=False)
    contact_phone = Column(String, nullable=True)
    contact_name = Column(String, nullable=True)

    status = Column(String, default="new")  # new/approved/rejected
    resolution_comment = Column(Text, nullable=True)
    processed_at = Column(DateTime, nullable=True)
    processed_by = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
