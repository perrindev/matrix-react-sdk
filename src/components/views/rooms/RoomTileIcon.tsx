/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import { DefaultTagID, TagID } from "../../../stores/room-list/models";
import { User } from "matrix-js-sdk/src/models/user";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import DMRoomMap from "../../../utils/DMRoomMap";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { isPresenceEnabled } from "../../../utils/presence";

enum Icon {
    // Note: the names here are used in CSS class names
    None = "NONE", // ... except this one
    Globe = "GLOBE",
    PresenceOnline = "ONLINE",
    PresenceAway = "AWAY",
    PresenceOffline = "OFFLINE",
}

interface IProps {
    room: Room;
    tag: TagID;
}

interface IState {
    icon: Icon;
}

export default class RoomTileIcon extends React.Component<IProps, IState> {
    private _dmUser: User;
    private isUnmounted = false;
    private isWatchingTimeline = false;

    constructor(props: IProps) {
        super(props);

        this.state = {
            icon: this.calculateIcon(),
        };
    }

    private get isPublicRoom(): boolean {
        const joinRules = this.props.room.currentState.getStateEvents("m.room.join_rules", "");
        const joinRule = joinRules && joinRules.getContent().join_rule;
        return joinRule === 'public';
    }

    private get dmUser(): User {
        return this._dmUser;
    }

    private set dmUser(val: User) {
        const oldUser = this._dmUser;
        this._dmUser = val;
        if (oldUser && oldUser !== this._dmUser) {
            oldUser.off('User.currentlyActive', this.onPresenceUpdate);
            oldUser.off('User.presence', this.onPresenceUpdate);
        }
        if (this._dmUser && oldUser !== this._dmUser) {
            this._dmUser.on('User.currentlyActive', this.onPresenceUpdate);
            this._dmUser.on('User.presence', this.onPresenceUpdate);
        }
    }

    public componentWillUnmount() {
        this.isUnmounted = true;
        if (this.isWatchingTimeline) this.props.room.off('Room.timeline', this.onRoomTimeline);
        this.dmUser = null; // clear listeners, if any
    }

    private onRoomTimeline = (ev: MatrixEvent, room: Room) => {
        if (this.isUnmounted) return;

        // apparently these can happen?
        if (!room) return;
        if (this.props.room.roomId !== room.roomId) return;

        if (ev.getType() === 'm.room.join_rules' || ev.getType() === 'm.room.member') {
            this.setState({icon: this.calculateIcon()});
        }
    };

    private onPresenceUpdate = () => {
        if (this.isUnmounted) return;

        let newIcon = this.getPresenceIcon();
        if (newIcon !== this.state.icon) this.setState({icon: newIcon});
    };

    private getPresenceIcon(): Icon {
        if (!this.dmUser) return Icon.None;

        let icon = Icon.None;

        const isOnline = this.dmUser.currentlyActive || this.dmUser.presence === 'online';
        if (isOnline) {
            icon = Icon.PresenceOnline;
        } else if (this.dmUser.presence === 'offline') {
            icon = Icon.PresenceOffline;
        } else if (this.dmUser.presence === 'unavailable') {
            icon = Icon.PresenceAway;
        }

        return icon;
    }

    private calculateIcon(): Icon {
        let icon = Icon.None;

        if (this.props.tag === DefaultTagID.DM && this.props.room.getJoinedMemberCount() === 2) {
            // Track presence, if available
            if (isPresenceEnabled()) {
                const otherUserId = DMRoomMap.shared().getUserIdForRoomId(this.props.room.roomId);
                if (otherUserId) {
                    this.dmUser = MatrixClientPeg.get().getUser(otherUserId);
                    icon = this.getPresenceIcon();
                }
            }
        } else {
            // Track publicity
            icon = this.isPublicRoom ? Icon.Globe : Icon.None;
            if (!this.isWatchingTimeline) {
                this.props.room.on('Room.timeline', this.onRoomTimeline);
                this.isWatchingTimeline = true;
            }
        }
        return icon;
    }

    public render(): React.ReactElement {
        if (this.state.icon === Icon.None) return null;

        return <span className={`mx_RoomTileIcon mx_RoomTileIcon_${this.state.icon.toLowerCase()}`} />;
    }
}
