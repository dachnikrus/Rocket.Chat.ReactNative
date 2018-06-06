import React from 'react';
import PropTypes from 'prop-types';
import { View, ScrollView, SafeAreaView, Keyboard, Image } from 'react-native';
import { connect } from 'react-redux';
import Dialog from 'react-native-dialog';
import SHA256 from 'js-sha256';
import Icon from 'react-native-vector-icons/MaterialIcons';

import LoggedView from '../View';
import KeyboardView from '../../presentation/KeyboardView';
import sharedStyles from '../Styles';
import styles from './styles';
import scrollPersistTaps from '../../utils/scrollPersistTaps';
import { showErrorAlert, showToast } from '../../utils/info';
import RocketChat from '../../lib/rocketchat';
import RCTextInput from '../../containers/TextInput';
import Loading from '../../containers/Loading';
import log from '../../utils/log';
import I18n from '../../i18n';
import Button from '../../containers/Button';
import Avatar from '../../containers/Avatar';
import Touch from '../../utils/touch';

@connect(state => ({
	user: state.login.user
}))
export default class ProfileView extends LoggedView {
	static propTypes = {
		navigation: PropTypes.object,
		user: PropTypes.object
	};

	constructor(props) {
		super('ProfileView', props);
		this.state = {
			showPasswordAlert: false,
			saving: false,
			name: null,
			username: null,
			email: null,
			newPassword: null,
			typedPassword: null,
			avatarUrl: null,
			avatar: {}
		};
	}

	componentDidMount() {
		this.init();
	}

	componentWillReceiveProps(nextProps) {
		if (this.props.user !== nextProps.user) {
			this.init(nextProps.user);
		}
	}

	init = (user) => {
		const {
			name, username, emails
		} = user || this.props.user;
		this.setState({
			name,
			username,
			email: emails ? emails[0].address : null,
			newPassword: null,
			typedPassword: null,
			avatarUrl: null,
			avatar: {}
		});
	}

	formIsChanged = () => {
		const {
			name, username, email, newPassword, avatarUrl
		} = this.state;
		const { user } = this.props;
		return !(user.name === name &&
			user.username === username &&
			!newPassword &&
			(user.emails && user.emails[0].address === email) &&
			!avatarUrl
		);
	}

	closePasswordAlert = () => {
		this.setState({ showPasswordAlert: false });
	}

	submit = async() => {
		Keyboard.dismiss();
		this.setState({ saving: true, showPasswordAlert: false });

		const {
			name, username, email, newPassword, typedPassword, avatar
		} = this.state;
		const { user } = this.props;

		if (!this.formIsChanged()) {
			return;
		}

		const params = {};

		// Name
		if (user.name !== name) {
			params.realname = name;
		}

		// Username
		if (user.username !== username) {
			params.username = username;
		}

		// Email
		if (user.emails && user.emails[0].address !== email) {
			params.email = email;
		}

		// newPassword
		if (newPassword) {
			params.newPassword = newPassword;
		}

		// typedPassword
		if (typedPassword) {
			params.typedPassword = SHA256(typedPassword);
		}

		const requirePassword = !!params.email || newPassword;
		if (requirePassword && !params.typedPassword) {
			return this.setState({ showPasswordAlert: true, saving: false });
		}

		try {
			if (avatar) {
				try {
					await RocketChat.setAvatarFromService(avatar);
				} catch (e) {
					return console.warn(e);
				}
			}

			await RocketChat.saveUserProfile(params);
			this.setState({ saving: false });
			setTimeout(() => {
				showToast(I18n.t('Profile_saved_successfully'));
				this.init();
			}, 300);
		} catch (e) {
			this.setState({ saving: false, typedPassword: null });
			setTimeout(() => {
				if (e && e.error) {
					return showErrorAlert(I18n.t(e.error, e.details));
				}
				showErrorAlert(I18n.t('There_was_an_error_while_action', { action: 'saving_profile' }));
				log('saveUserProfile', e);
			}, 300);
		}
	}

	setAvatar = (avatar) => {
		this.setState({ avatar });
	}

	resetAvatar = async() => {
		try {
			await RocketChat.resetAvatar();
			showToast(I18n.t('Avatar_changed_successfully'));
		} catch (e) {
			if (e && e.error) {
				if (e.details.timeToReset) {
					return showErrorAlert(I18n.t('error-too-many-requests', {
						seconds: parseInt(e.details.timeToReset / 1000, 10)
					}));
				}
				return showErrorAlert(I18n.t(e.error, e.details));
			}
			showErrorAlert(I18n.t('There_was_an_error_while_action', { action: 'changing_avatar' }));
			log('resetAvatar', e);
		}
	}

	renderAvatarButton = ({ child, onPress }) => (
		<Touch
			onPress={onPress}
			underlayColor='rgba(255, 255, 255, 0.5)'
			activeOpacity={0.3}
			testID='sidebar-toggle-server'
		>
			<View
				style={{
					backgroundColor: '#e1e5e8',
					width: 50,
					height: 50,
					alignItems: 'center',
					justifyContent: 'center',
					marginRight: 15,
					marginBottom: 15,
					borderRadius: 2
				}}
			>
				{child}
			</View>
		</Touch>
	)

	renderAvatarButtons = () => {
		return (
			<View style={{ flexWrap: 'wrap', flexDirection: 'row', justifyContent: 'flex-start' }}>
				{this.renderAvatarButton({
					child: (
						<Avatar
							text={this.props.user.username}
							size={50}
							type='@'
						/>
					),
					onPress: () => this.resetAvatar()
				})}
				{this.renderAvatarButton({
					child: (
						<Icon
							name='file-upload'
							size={30}
						/>
					),
					onPress: () => {}
				})}
				{this.renderAvatarButton({
					child: (
						<Icon
							name='link'
							size={30}
						/>
					),
					onPress: () => this.setAvatar({ url: this.state.avatarUrl, service: 'url' })
				})}
			</View>
		);
	}

	render() {
		const {
			name, username, email, newPassword, avatarUrl
		} = this.state;
		return (
			<KeyboardView
				contentContainerStyle={sharedStyles.container}
				keyboardVerticalOffset={128}
			>
				<ScrollView
					contentContainerStyle={sharedStyles.containerScrollView}
					testID='profile-view-list'
					{...scrollPersistTaps}
				>
					<SafeAreaView testID='profile-view'>
						<View style={styles.avatarContainer}>
							<Avatar
								text={username}
								avatar={this.state.avatar && this.state.avatar.url}
								size={100}
							/>
						</View>
						<RCTextInput
							inputRef={(e) => { this.name = e; }}
							label={I18n.t('Name')}
							placeholder={I18n.t('Name')}
							value={name}
							onChangeText={value => this.setState({ name: value })}
							onSubmitEditing={() => { this.username.focus(); }}
							testID='profile-view-name'
						/>
						<RCTextInput
							inputRef={(e) => { this.username = e; }}
							label={I18n.t('Username')}
							placeholder={I18n.t('Username')}
							value={username}
							onChangeText={value => this.setState({ username: value })}
							onSubmitEditing={() => { this.email.focus(); }}
							testID='profile-view-username'
						/>
						<RCTextInput
							inputRef={(e) => { this.email = e; }}
							label={I18n.t('Email')}
							placeholder={I18n.t('Email')}
							value={email}
							onChangeText={value => this.setState({ email: value })}
							onSubmitEditing={() => { this.newPassword.focus(); }}
							testID='profile-view-email'
						/>
						<RCTextInput
							inputRef={(e) => { this.newPassword = e; }}
							label={I18n.t('New_Password')}
							placeholder={I18n.t('New_Password')}
							value={newPassword}
							onChangeText={value => this.setState({ newPassword: value })}
							onSubmitEditing={() => { this.avatarUrl.focus(); }}
							secureTextEntry
							testID='profile-view-new-password'
						/>
						<RCTextInput
							inputRef={(e) => { this.avatarUrl = e; }}
							label={I18n.t('Avatar_Url')}
							placeholder={I18n.t('Avatar_Url')}
							value={avatarUrl}
							onChangeText={value => this.setState({ avatarUrl: value })}
							onSubmitEditing={this.submit}
							testID='profile-view-avatar-url'
						/>
						{this.renderAvatarButtons()}
						<View style={sharedStyles.alignItemsFlexStart}>
							<Button
								title={I18n.t('Save_Changes')}
								type='primary'
								onPress={this.submit}
								disabled={!this.formIsChanged()}
								testID='new-server-view-button'
							/>
						</View>
						<Loading visible={this.state.saving} />
						<Dialog.Container visible={this.state.showPasswordAlert}>
							<Dialog.Title>
								{I18n.t('Please_enter_your_password')}
							</Dialog.Title>
							<Dialog.Description>
								{I18n.t('For_your_security_you_must_enter_your_current_password_to_continue')}
							</Dialog.Description>
							<Dialog.Input
								onChangeText={value => this.setState({ typedPassword: value })}
								secureTextEntry
							/>
							<Dialog.Button label={I18n.t('Cancel')} onPress={this.closePasswordAlert} />
							<Dialog.Button label={I18n.t('Save')} onPress={this.submit} />
						</Dialog.Container>
					</SafeAreaView>
				</ScrollView>
			</KeyboardView>
		);
	}
}
