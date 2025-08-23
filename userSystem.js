// 사용자 시스템 (프로필, 친구, 설정)
const db = require('./database');
const { v4: uuidv4 } = require('uuid');

class UserSystemManager {
    constructor() {
        this.onlineFriends = new Map(); // username -> Set(friend usernames)
        this.friendRequests = new Map(); // username -> Set(pending request usernames)
    }

    // 사용자 프로필 생성/업데이트
    async createUserProfile(username, profileData = {}) {
        try {
            const defaultProfile = {
                display_name: profileData.display_name || username,
                avatar: profileData.avatar || 'default',
                bio: profileData.bio || '',
                preferred_game_mode: profileData.preferred_game_mode || 'BASIC',
                notifications_enabled: profileData.notifications_enabled !== false,
                sound_enabled: profileData.sound_enabled !== false,
                theme: profileData.theme || 'dark',
                language: profileData.language || 'ko',
                privacy_level: profileData.privacy_level || 'public', // public, friends, private
                show_online_status: profileData.show_online_status !== false,
                created_at: new Date(),
                updated_at: new Date()
            };

            await db.createUserProfile(username, defaultProfile);
            console.log(`[User Profile] 프로필 생성: ${username}`);
            return defaultProfile;
        } catch (error) {
            console.error('[User Profile] 프로필 생성 실패:', error);
            return null;
        }
    }

    // 사용자 프로필 조회
    async getUserProfile(username) {
        try {
            const profile = await db.getUserProfile(username);
            if (!profile) {
                // 프로필이 없으면 기본 프로필 생성
                return await this.createUserProfile(username);
            }
            return profile;
        } catch (error) {
            console.error('[User Profile] 프로필 조회 실패:', error);
            return null;
        }
    }

    // 사용자 프로필 업데이트
    async updateUserProfile(username, updates) {
        try {
            const allowedFields = [
                'display_name', 'avatar', 'bio', 'preferred_game_mode',
                'notifications_enabled', 'sound_enabled', 'theme', 'language',
                'privacy_level', 'show_online_status'
            ];

            const filteredUpdates = {};
            for (const field of allowedFields) {
                if (updates.hasOwnProperty(field)) {
                    filteredUpdates[field] = updates[field];
                }
            }

            filteredUpdates.updated_at = new Date();
            
            await db.updateUserProfile(username, filteredUpdates);
            console.log(`[User Profile] 프로필 업데이트: ${username}`);
            return true;
        } catch (error) {
            console.error('[User Profile] 프로필 업데이트 실패:', error);
            return false;
        }
    }

    // 친구 요청 전송
    async sendFriendRequest(fromUsername, toUsername) {
        try {
            // 자기 자신에게 요청 방지
            if (fromUsername === toUsername) {
                return { success: false, message: '자기 자신에게는 친구 요청을 보낼 수 없습니다.' };
            }

            // 대상 사용자 존재 확인
            const targetProfile = await this.getUserProfile(toUsername);
            if (!targetProfile) {
                return { success: false, message: '존재하지 않는 사용자입니다.' };
            }

            // 이미 친구인지 확인
            const existingFriendship = await db.getFriendship(fromUsername, toUsername);
            if (existingFriendship && existingFriendship.status === 'accepted') {
                return { success: false, message: '이미 친구입니다.' };
            }

            // 이미 요청이 있는지 확인
            if (existingFriendship && existingFriendship.status === 'pending') {
                return { success: false, message: '이미 친구 요청을 보냈습니다.' };
            }

            // 친구 요청 저장
            const requestId = uuidv4();
            await db.createFriendRequest(requestId, fromUsername, toUsername);
            
            // 메모리에 요청 추가
            if (!this.friendRequests.has(toUsername)) {
                this.friendRequests.set(toUsername, new Set());
            }
            this.friendRequests.get(toUsername).add(fromUsername);

            console.log(`[Friend Request] ${fromUsername} -> ${toUsername} 친구 요청 전송`);
            return { success: true, message: '친구 요청을 보냈습니다.' };
        } catch (error) {
            console.error('[Friend Request] 친구 요청 실패:', error);
            return { success: false, message: '친구 요청 처리 중 오류가 발생했습니다.' };
        }
    }

    // 친구 요청 응답
    async respondToFriendRequest(username, fromUsername, accept) {
        try {
            const friendship = await db.getFriendship(fromUsername, username);
            if (!friendship || friendship.status !== 'pending') {
                return { success: false, message: '해당 친구 요청을 찾을 수 없습니다.' };
            }

            if (accept) {
                // 친구 요청 수락
                await db.updateFriendshipStatus(friendship.id, 'accepted');
                
                // 메모리에서 친구 관계 추가
                if (!this.onlineFriends.has(username)) {
                    this.onlineFriends.set(username, new Set());
                }
                if (!this.onlineFriends.has(fromUsername)) {
                    this.onlineFriends.set(fromUsername, new Set());
                }
                this.onlineFriends.get(username).add(fromUsername);
                this.onlineFriends.get(fromUsername).add(username);

                console.log(`[Friend Request] ${username}이 ${fromUsername}의 친구 요청 수락`);
                return { success: true, message: '친구 요청을 수락했습니다.' };
            } else {
                // 친구 요청 거절
                await db.updateFriendshipStatus(friendship.id, 'rejected');
                console.log(`[Friend Request] ${username}이 ${fromUsername}의 친구 요청 거절`);
                return { success: true, message: '친구 요청을 거절했습니다.' };
            }
        } catch (error) {
            console.error('[Friend Request] 친구 요청 응답 실패:', error);
            return { success: false, message: '친구 요청 처리 중 오류가 발생했습니다.' };
        } finally {
            // 메모리에서 요청 제거
            if (this.friendRequests.has(username)) {
                this.friendRequests.get(username).delete(fromUsername);
            }
        }
    }

    // 친구 목록 조회
    async getFriends(username) {
        try {
            const friendships = await db.getUserFriends(username);
            const friends = friendships.map(f => {
                const friendUsername = f.requester === username ? f.addressee : f.requester;
                return {
                    username: friendUsername,
                    status: 'accepted',
                    since: f.created_at,
                    isOnline: this.isUserOnline(friendUsername)
                };
            });

            return friends;
        } catch (error) {
            console.error('[Friends] 친구 목록 조회 실패:', error);
            return [];
        }
    }

    // 받은 친구 요청 목록 조회
    async getPendingFriendRequests(username) {
        try {
            const requests = await db.getPendingFriendRequests(username);
            return requests.map(r => ({
                from: r.requester,
                createdAt: r.created_at
            }));
        } catch (error) {
            console.error('[Friend Requests] 친구 요청 목록 조회 실패:', error);
            return [];
        }
    }

    // 친구 삭제
    async removeFriend(username, friendUsername) {
        try {
            const friendship = await db.getFriendship(username, friendUsername);
            if (!friendship || friendship.status !== 'accepted') {
                return { success: false, message: '친구 관계를 찾을 수 없습니다.' };
            }

            await db.deleteFriendship(friendship.id);
            
            // 메모리에서 친구 관계 제거
            if (this.onlineFriends.has(username)) {
                this.onlineFriends.get(username).delete(friendUsername);
            }
            if (this.onlineFriends.has(friendUsername)) {
                this.onlineFriends.get(friendUsername).delete(username);
            }

            console.log(`[Friend Remove] ${username}이 ${friendUsername}와의 친구 관계 해제`);
            return { success: true, message: '친구 관계를 해제했습니다.' };
        } catch (error) {
            console.error('[Friend Remove] 친구 삭제 실패:', error);
            return { success: false, message: '친구 삭제 중 오류가 발생했습니다.' };
        }
    }

    // 게임 초대 전송
    async sendGameInvite(fromUsername, toUsername, roomId, roomName) {
        try {
            // 친구 관계 확인
            const friendship = await db.getFriendship(fromUsername, toUsername);
            if (!friendship || friendship.status !== 'accepted') {
                return { success: false, message: '친구만 게임에 초대할 수 있습니다.' };
            }

            const inviteId = uuidv4();
            const invitation = {
                id: inviteId,
                from: fromUsername,
                to: toUsername,
                roomId: roomId,
                roomName: roomName,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5분 후 만료
            };

            await db.createGameInvitation(invitation);
            
            console.log(`[Game Invite] ${fromUsername} -> ${toUsername} 게임 초대 (방: ${roomName})`);
            return { success: true, inviteId: inviteId, message: '게임 초대를 보냈습니다.' };
        } catch (error) {
            console.error('[Game Invite] 게임 초대 실패:', error);
            return { success: false, message: '게임 초대 중 오류가 발생했습니다.' };
        }
    }

    // 게임 초대 응답
    async respondToGameInvite(username, inviteId, accept) {
        try {
            const invitation = await db.getGameInvitation(inviteId);
            if (!invitation) {
                return { success: false, message: '초대를 찾을 수 없습니다.' };
            }

            if (invitation.to !== username) {
                return { success: false, message: '이 초대는 당신을 위한 것이 아닙니다.' };
            }

            if (new Date() > invitation.expiresAt) {
                return { success: false, message: '초대가 만료되었습니다.' };
            }

            if (accept) {
                // 초대 수락 - 방 정보 반환
                await db.updateGameInvitationStatus(inviteId, 'accepted');
                return { 
                    success: true, 
                    roomId: invitation.roomId,
                    roomName: invitation.roomName,
                    message: '게임 초대를 수락했습니다.' 
                };
            } else {
                // 초대 거절
                await db.updateGameInvitationStatus(inviteId, 'rejected');
                return { success: true, message: '게임 초대를 거절했습니다.' };
            }
        } catch (error) {
            console.error('[Game Invite Response] 게임 초대 응답 실패:', error);
            return { success: false, message: '게임 초대 응답 중 오류가 발생했습니다.' };
        }
    }

    // 사용자 검색
    async searchUsers(query, currentUsername, limit = 20) {
        try {
            const users = await db.searchUsers(query, limit);
            
            // 현재 사용자와 친구 관계 정보 포함
            const results = [];
            for (const user of users) {
                if (user.username === currentUsername) continue; // 자기 자신 제외
                
                const friendship = await db.getFriendship(currentUsername, user.username);
                const friendStatus = friendship ? friendship.status : 'none';
                
                results.push({
                    username: user.username,
                    displayName: user.display_name,
                    avatar: user.avatar,
                    isOnline: this.isUserOnline(user.username),
                    friendStatus: friendStatus
                });
            }
            
            return results;
        } catch (error) {
            console.error('[User Search] 사용자 검색 실패:', error);
            return [];
        }
    }

    // 온라인 상태 관리
    setUserOnline(username) {
        // 친구들의 온라인 상태 업데이트 알림
        if (this.onlineFriends.has(username)) {
            return Array.from(this.onlineFriends.get(username));
        }
        return [];
    }

    setUserOffline(username) {
        // 친구들의 오프라인 상태 업데이트 알림
        if (this.onlineFriends.has(username)) {
            return Array.from(this.onlineFriends.get(username));
        }
        return [];
    }

    isUserOnline(username) {
        // 실제 구현에서는 온라인 사용자 Map에서 확인
        return false; // 임시
    }

    // 사용자 차단
    async blockUser(username, targetUsername) {
        try {
            // 기존 친구 관계 해제
            const friendship = await db.getFriendship(username, targetUsername);
            if (friendship) {
                await db.deleteFriendship(friendship.id);
            }

            // 차단 관계 생성
            await db.createUserBlock(username, targetUsername);
            
            console.log(`[User Block] ${username}이 ${targetUsername} 차단`);
            return { success: true, message: '사용자를 차단했습니다.' };
        } catch (error) {
            console.error('[User Block] 사용자 차단 실패:', error);
            return { success: false, message: '사용자 차단 중 오류가 발생했습니다.' };
        }
    }

    // 차단 해제
    async unblockUser(username, targetUsername) {
        try {
            await db.removeUserBlock(username, targetUsername);
            
            console.log(`[User Unblock] ${username}이 ${targetUsername} 차단 해제`);
            return { success: true, message: '차단을 해제했습니다.' };
        } catch (error) {
            console.error('[User Unblock] 차단 해제 실패:', error);
            return { success: false, message: '차단 해제 중 오류가 발생했습니다.' };
        }
    }

    // 차단된 사용자 목록
    async getBlockedUsers(username) {
        try {
            return await db.getBlockedUsers(username);
        } catch (error) {
            console.error('[Blocked Users] 차단 목록 조회 실패:', error);
            return [];
        }
    }

    // 사용자 신고
    async reportUser(reporterUsername, targetUsername, reason, description = '') {
        try {
            const reportId = uuidv4();
            const report = {
                id: reportId,
                reporter: reporterUsername,
                target: targetUsername,
                reason: reason,
                description: description,
                status: 'pending',
                createdAt: new Date()
            };

            await db.createUserReport(report);
            
            console.log(`[User Report] ${reporterUsername}이 ${targetUsername} 신고 (이유: ${reason})`);
            return { success: true, reportId: reportId, message: '신고가 접수되었습니다.' };
        } catch (error) {
            console.error('[User Report] 사용자 신고 실패:', error);
            return { success: false, message: '신고 접수 중 오류가 발생했습니다.' };
        }
    }
}

module.exports = UserSystemManager;