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

import * as React from "react";
import { createRef } from "react";
import classNames from "classnames";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { _t } from "../../languageHandler";
import { ActionPayload } from "../../dispatcher/payloads";
import { throttle } from 'lodash';
import { Key } from "../../Keyboard";
import AccessibleButton from "../views/elements/AccessibleButton";
import { Action } from "../../dispatcher/actions";

// TODO: Remove banner on launch: https://github.com/vector-im/riot-web/issues/14231

/*******************************************************************
 *   CAUTION                                                       *
 *******************************************************************
 * This is a work in progress implementation and isn't complete or *
 * even useful as a component. Please avoid using it until this    *
 * warning disappears.                                             *
 *******************************************************************/

interface IProps {
    onQueryUpdate: (newQuery: string) => void;
    isMinimized: boolean;
}

interface IState {
    query: string;
    focused: boolean;
}

export default class RoomSearch extends React.PureComponent<IProps, IState> {
    private dispatcherRef: string;
    private inputRef: React.RefObject<HTMLInputElement> = createRef();

    constructor(props: IProps) {
        super(props);

        this.state = {
            query: "",
            focused: false,
        };

        this.dispatcherRef = defaultDispatcher.register(this.onAction);
    }

    public componentWillUnmount() {
        defaultDispatcher.unregister(this.dispatcherRef);
    }

    private onAction = (payload: ActionPayload) => {
        if (payload.action === 'view_room' && payload.clear_search) {
            this.clearInput();
        } else if (payload.action === 'focus_room_filter' && this.inputRef.current) {
            this.inputRef.current.focus();
        }
    };

    private clearInput = () => {
        if (!this.inputRef.current) return;
        this.inputRef.current.value = "";
        this.onChange();
    };

    private openSearch = () => {
        defaultDispatcher.dispatch({action: "show_left_panel"});
    };

    private onChange = () => {
        if (!this.inputRef.current) return;
        this.setState({query: this.inputRef.current.value});
        this.onSearchUpdated();
    };

    // it wants this at the top of the file, but we know better
    // tslint:disable-next-line
    private onSearchUpdated = throttle(
        () => {
            // We can't use the state variable because it can lag behind the input.
            // The lag is most obvious when deleting/clearing text with the keyboard.
            this.props.onQueryUpdate(this.inputRef.current.value);
        }, 200, {trailing: true, leading: true},
    );

    private onFocus = (ev: React.FocusEvent<HTMLInputElement>) => {
        this.setState({focused: true});
        ev.target.select();
    };

    private onBlur = () => {
        this.setState({focused: false});
    };

    private onKeyDown = (ev: React.KeyboardEvent) => {
        if (ev.key === Key.ESCAPE) {
            this.clearInput();
            defaultDispatcher.fire(Action.FocusComposer);
        }
    };

    public render(): React.ReactNode {
        const classes = classNames({
            'mx_RoomSearch': true,
            'mx_RoomSearch_expanded': this.state.query || this.state.focused,
            'mx_RoomSearch_minimized': this.props.isMinimized,
        });

        const inputClasses = classNames({
            'mx_RoomSearch_input': true,
            'mx_RoomSearch_inputExpanded': this.state.query || this.state.focused,
        });

        let icon = (
            <div className='mx_RoomSearch_icon'/>
        );
        let input = (
            <input
                type="text"
                ref={this.inputRef}
                className={inputClasses}
                value={this.state.query}
                onFocus={this.onFocus}
                onBlur={this.onBlur}
                onChange={this.onChange}
                onKeyDown={this.onKeyDown}
                placeholder={_t("Search")}
                autoComplete="off"
            />
        );
        let clearButton = (
            <AccessibleButton
                tabIndex={-1}
                className='mx_RoomSearch_clearButton'
                onClick={this.clearInput}
            />
        );

        if (this.props.isMinimized) {
            icon = (
                <AccessibleButton
                    tabIndex={-1}
                    className='mx_RoomSearch_icon'
                    onClick={this.openSearch}
                />
            );
            input = null;
            clearButton = null;
        }

        return (
            <div className={classes}>
                {icon}
                {input}
                {clearButton}
            </div>
        );
    }
}
