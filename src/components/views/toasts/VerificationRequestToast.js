/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import React from 'react';
import PropTypes from 'prop-types';
import * as sdk from "../../../index";
import { _t } from '../../../languageHandler';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import {RIGHT_PANEL_PHASES} from "../../../stores/RightPanelStorePhases";
import {userLabelForEventRoom} from "../../../utils/KeyVerificationStateObserver";
import dis from "../../../dispatcher";
import ToastStore from "../../../stores/ToastStore";

export default class VerificationRequestToast extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {counter: Math.ceil(props.request.timeout / 1000)};
    }

    componentDidMount() {
        const {request} = this.props;
        this._intervalHandle = setInterval(() => {
            let {counter} = this.state;
            counter = Math.max(0, counter - 1);
            this.setState({counter});
        }, 1000);
        request.on("change", this._checkRequestIsPending);
    }

    componentWillUnmount() {
        clearInterval(this._intervalHandle);
        const {request} = this.props;
        request.off("change", this._checkRequestIsPending);
    }

    _checkRequestIsPending = () => {
        const {request} = this.props;
        if (request.ready || request.started || request.done || request.cancelled || request.observeOnly) {
            ToastStore.sharedInstance().dismissToast(this.props.toastKey);
        }
    };

    cancel = () => {
        ToastStore.sharedInstance().dismissToast(this.props.toastKey);
        try {
            this.props.request.cancel();
        } catch (err) {
            console.error("Error while cancelling verification request", err);
        }
    }

    accept = async () => {
        ToastStore.sharedInstance().dismissToast(this.props.toastKey);
        const {request} = this.props;
        const {event} = request;
        // no room id for to_device requests
        if (event.getRoomId()) {
            dis.dispatch({
                action: 'view_room',
                room_id: event.getRoomId(),
                should_peek: false,
            });
        }
        try {
            await request.accept();
            dis.dispatch({
                action: "set_right_panel_phase",
                phase: RIGHT_PANEL_PHASES.EncryptionPanel,
                refireParams: {verificationRequest: request},
            });
        } catch (err) {
            console.error(err.message);
        }
    };

    render() {
        const FormButton = sdk.getComponent("elements.FormButton");
        const {request} = this.props;
        const {event} = request;
        const userId = request.otherUserId;
        let nameLabel = event.getRoomId() ? userLabelForEventRoom(userId, event) : userId;
        // for legacy to_device verification requests
        if (nameLabel === userId) {
            const client = MatrixClientPeg.get();
            const user = client.getUser(event.getSender());
            if (user && user.displayName) {
                nameLabel = _t("%(name)s (%(userId)s)", {name: user.displayName, userId});
            }
        }
        return (<div>
            <div className="mx_Toast_description">{nameLabel}</div>
            <div className="mx_Toast_buttons" aria-live="off">
                <FormButton label={_t("Decline (%(counter)s)", {counter: this.state.counter})} kind="danger" onClick={this.cancel} />
                <FormButton label={_t("Accept")} onClick={this.accept} />
            </div>
        </div>);
    }
}

VerificationRequestToast.propTypes = {
    request: PropTypes.object.isRequired,
    toastKey: PropTypes.string.isRequired,
};
