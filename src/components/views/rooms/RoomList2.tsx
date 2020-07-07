/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017, 2018 Vector Creations Ltd
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

import * as React from "react";
import { _t, _td } from "../../../languageHandler";
import { RovingTabIndexProvider } from "../../../accessibility/RovingTabIndex";
import { ResizeNotifier } from "../../../utils/ResizeNotifier";
import RoomListStore, { LISTS_UPDATE_EVENT, RoomListStore2 } from "../../../stores/room-list/RoomListStore2";
import { ITagMap } from "../../../stores/room-list/algorithms/models";
import { DefaultTagID, TagID } from "../../../stores/room-list/models";
import { Dispatcher } from "flux";
import dis from "../../../dispatcher/dispatcher";
import RoomSublist2 from "./RoomSublist2";
import { ActionPayload } from "../../../dispatcher/payloads";
import { NameFilterCondition } from "../../../stores/room-list/filters/NameFilterCondition";
import { ListLayout } from "../../../stores/room-list/ListLayout";

// TODO: Remove banner on launch: https://github.com/vector-im/riot-web/issues/14231
// TODO: Rename on launch: https://github.com/vector-im/riot-web/issues/14231

/*******************************************************************
 *   CAUTION                                                       *
 *******************************************************************
 * This is a work in progress implementation and isn't complete or *
 * even useful as a component. Please avoid using it until this    *
 * warning disappears.                                             *
 *******************************************************************/

interface IProps {
    onKeyDown: (ev: React.KeyboardEvent) => void;
    onFocus: (ev: React.FocusEvent) => void;
    onBlur: (ev: React.FocusEvent) => void;
    resizeNotifier: ResizeNotifier;
    collapsed: boolean;
    searchFilter: string;
    isMinimized: boolean;
}

interface IState {
    sublists: ITagMap;
    layouts: Map<TagID, ListLayout>;
}

const TAG_ORDER: TagID[] = [
    // -- Community Invites Placeholder --

    DefaultTagID.Invite,
    DefaultTagID.Favourite,
    DefaultTagID.DM,
    DefaultTagID.Untagged,

    // -- Custom Tags Placeholder --

    DefaultTagID.LowPriority,
    DefaultTagID.ServerNotice,
    DefaultTagID.Archived,
];
const COMMUNITY_TAGS_BEFORE_TAG = DefaultTagID.Invite;
const CUSTOM_TAGS_BEFORE_TAG = DefaultTagID.LowPriority;
const ALWAYS_VISIBLE_TAGS: TagID[] = [
    DefaultTagID.DM,
    DefaultTagID.Untagged,
];

interface ITagAesthetics {
    sectionLabel: string;
    addRoomLabel?: string;
    onAddRoom?: (dispatcher: Dispatcher<ActionPayload>) => void;
    isInvite: boolean;
    defaultHidden: boolean;
}

const TAG_AESTHETICS: {
    // @ts-ignore - TS wants this to be a string but we know better
    [tagId: TagID]: ITagAesthetics;
} = {
    [DefaultTagID.Invite]: {
        sectionLabel: _td("Invites"),
        isInvite: true,
        defaultHidden: false,
    },
    [DefaultTagID.Favourite]: {
        sectionLabel: _td("Favourites"),
        isInvite: false,
        defaultHidden: false,
    },
    [DefaultTagID.DM]: {
        sectionLabel: _td("People"),
        isInvite: false,
        defaultHidden: false,
        addRoomLabel: _td("Start chat"),
        onAddRoom: (dispatcher: Dispatcher<ActionPayload>) => dispatcher.dispatch({action: 'view_create_chat'}),
    },
    [DefaultTagID.Untagged]: {
        sectionLabel: _td("Rooms"),
        isInvite: false,
        defaultHidden: false,
        addRoomLabel: _td("Create room"),
        onAddRoom: (dispatcher: Dispatcher<ActionPayload>) => dispatcher.dispatch({action: 'view_create_room'}),
    },
    [DefaultTagID.LowPriority]: {
        sectionLabel: _td("Low priority"),
        isInvite: false,
        defaultHidden: false,
    },
    [DefaultTagID.ServerNotice]: {
        sectionLabel: _td("System Alerts"),
        isInvite: false,
        defaultHidden: false,
    },

    // TODO: Replace with archived view: https://github.com/vector-im/riot-web/issues/14038
    [DefaultTagID.Archived]: {
        sectionLabel: _td("Historical"),
        isInvite: false,
        defaultHidden: true,
    },
};

export default class RoomList2 extends React.Component<IProps, IState> {
    private searchFilter: NameFilterCondition = new NameFilterCondition();

    constructor(props: IProps) {
        super(props);

        this.state = {
            sublists: {},
            layouts: new Map<TagID, ListLayout>(),
        };
    }

    public componentDidUpdate(prevProps: Readonly<IProps>): void {
        if (prevProps.searchFilter !== this.props.searchFilter) {
            const hadSearch = !!this.searchFilter.search.trim();
            const haveSearch = !!this.props.searchFilter.trim();
            this.searchFilter.search = this.props.searchFilter;
            if (!hadSearch && haveSearch) {
                // started a new filter - add the condition
                RoomListStore.instance.addFilter(this.searchFilter);
            } else if (hadSearch && !haveSearch) {
                // cleared a filter - remove the condition
                RoomListStore.instance.removeFilter(this.searchFilter);
            } // else the filter hasn't changed enough for us to care here
        }
    }

    public componentDidMount(): void {
        RoomListStore.instance.on(LISTS_UPDATE_EVENT, (store: RoomListStore2) => {
            const newLists = store.orderedLists;
            console.log("new lists", newLists);

            const layoutMap = new Map<TagID, ListLayout>();
            for (const tagId of Object.keys(newLists)) {
                layoutMap.set(tagId, new ListLayout(tagId));
            }

            this.setState({sublists: newLists, layouts: layoutMap});
        });
    }

    private renderSublists(): React.ReactElement[] {
        const components: React.ReactElement[] = [];

        for (const orderedTagId of TAG_ORDER) {
            if (COMMUNITY_TAGS_BEFORE_TAG === orderedTagId) {
                // Populate community invites if we have the chance
                // TODO: Community invites: https://github.com/vector-im/riot-web/issues/14179
            }
            if (CUSTOM_TAGS_BEFORE_TAG === orderedTagId) {
                // Populate custom tags if needed
                // TODO: Custom tags: https://github.com/vector-im/riot-web/issues/14091
            }

            const orderedRooms = this.state.sublists[orderedTagId] || [];
            if (orderedRooms.length === 0 && !ALWAYS_VISIBLE_TAGS.includes(orderedTagId)) {
                continue; // skip tag - not needed
            }

            const aesthetics: ITagAesthetics = TAG_AESTHETICS[orderedTagId];
            if (!aesthetics) throw new Error(`Tag ${orderedTagId} does not have aesthetics`);

            const onAddRoomFn = aesthetics.onAddRoom ? () => aesthetics.onAddRoom(dis) : null;
            components.push(
                <RoomSublist2
                    key={`sublist-${orderedTagId}`}
                    tagId={orderedTagId}
                    forRooms={true}
                    rooms={orderedRooms}
                    startAsHidden={aesthetics.defaultHidden}
                    label={_t(aesthetics.sectionLabel)}
                    onAddRoom={onAddRoomFn}
                    addRoomLabel={aesthetics.addRoomLabel}
                    isInvite={aesthetics.isInvite}
                    layout={this.state.layouts.get(orderedTagId)}
                    isMinimized={this.props.isMinimized}
                />
            );
        }

        return components;
    }

    public render() {
        const sublists = this.renderSublists();
        return (
            <RovingTabIndexProvider handleHomeEnd={true} onKeyDown={this.props.onKeyDown}>
                {({onKeyDownHandler}) => (
                    <div
                        onFocus={this.props.onFocus}
                        onBlur={this.props.onBlur}
                        onKeyDown={onKeyDownHandler}
                        className="mx_RoomList2"
                        role="tree"
                        aria-label={_t("Rooms")}
                        // Firefox sometimes makes this element focusable due to
                        // overflow:scroll;, so force it out of tab order.
                        tabIndex={-1}
                    >{sublists}</div>
                )}
            </RovingTabIndexProvider>
        );
    }
}
