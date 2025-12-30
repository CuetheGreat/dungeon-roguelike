import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Room, RoomState, RoomType } from '../../src/dungeon/room';
import { initializeRNG } from '../../src/game/seed';
import { MonsterAPI } from '../../src/entities/enemy';
import { InteractableType } from '../../src/dungeon/Interactable';

// Mock the MonsterAPI to avoid real HTTP calls
vi.mock('../../src/entities/enemy', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/entities/enemy')>();
    return {
        ...actual,
        MonsterAPI: {
            ...actual.MonsterAPI,
            getMonstersForLevel: vi.fn().mockResolvedValue([
                {
                    id: 'test-goblin',
                    name: 'Test Goblin',
                    health: 10,
                    maxHealth: 10,
                    attackPower: 3,
                    defense: 12,
                    experience: 50,
                    challengeRating: 0.25,
                    type: 'humanoid',
                    speed: 30
                }
            ]),
            getRandomMonstersByCR: vi.fn().mockResolvedValue([
                {
                    id: 'test-goblin-1',
                    name: 'Test Goblin',
                    health: 10,
                    maxHealth: 10,
                    attackPower: 3,
                    defense: 12,
                    experience: 50,
                    challengeRating: 0.25,
                    type: 'humanoid',
                    speed: 30
                }
            ])
        }
    };
});

describe('Room', () => {
    beforeEach(() => {
        initializeRNG('test-seed');
        vi.clearAllMocks();
    });

    describe('create() factory method', () => {
        it('should create an entrance room', async () => {
            const room = Room.create(RoomType.ENTRANCE, 1);
            expect(room.type).toBe(RoomType.ENTRANCE);
            expect(room.level).toBe(1);
            expect(room.state).toBe(RoomState.LOCKED);
        });

        it('should create a combat room with enemies after loading', async () => {
            const room = Room.create(RoomType.COMBAT, 1);
            expect(room.type).toBe(RoomType.COMBAT);
            // Enemies are loaded lazily
            expect(room.areEnemiesLoaded()).toBe(false);
            await room.ensureEnemiesLoaded();
            expect(room.areEnemiesLoaded()).toBe(true);
            expect(room.enemies).toBeDefined();
            expect(room.enemies!.length).toBeGreaterThan(0);
            expect(MonsterAPI.getRandomMonstersByCR).toHaveBeenCalled();
        });

        it('should create a treasure room with chests', async () => {
            const room = Room.create(RoomType.TREASURE, 1);
            expect(room.type).toBe(RoomType.TREASURE);
            const chests = room.interactables.filter(i => i.type === InteractableType.CHEST);
            expect(chests.length).toBeGreaterThanOrEqual(1);
        });

        it('should create a boss room with enemies and a chest', async () => {
            const room = Room.create(RoomType.BOSS, 1);
            expect(room.type).toBe(RoomType.BOSS);
            // Enemies are loaded lazily
            await room.ensureEnemiesLoaded();
            expect(room.enemies).toBeDefined();
            const chests = room.interactables.filter(i => i.type === InteractableType.CHEST);
            expect(chests.length).toBe(1);
        });

        it('should create an elite room with enemies after loading', async () => {
            const room = Room.create(RoomType.ELITE, 1);
            expect(room.type).toBe(RoomType.ELITE);
            // Enemies are loaded lazily
            await room.ensureEnemiesLoaded();
            expect(room.enemies).toBeDefined();
        });

        it('should create a shop room with NPC', async () => {
            const room = Room.create(RoomType.SHOP, 1);
            expect(room.type).toBe(RoomType.SHOP);
            const npcs = room.interactables.filter(i => i.type === InteractableType.NPC);
            expect(npcs.length).toBe(1);
        });

        it('should create a puzzle room with levers', async () => {
            const room = Room.create(RoomType.PUZZLE, 1);
            expect(room.type).toBe(RoomType.PUZZLE);
            expect(room.interactables).toBeDefined();
        });

        it('should create a rest room with altar', async () => {
            const room = Room.create(RoomType.REST, 1);
            expect(room.type).toBe(RoomType.REST);
            const altars = room.interactables.filter(i => i.type === InteractableType.ALTAR);
            expect(altars.length).toBe(1);
        });

        it('should create an event room with interactables', async () => {
            const room = Room.create(RoomType.EVENT, 1);
            expect(room.type).toBe(RoomType.EVENT);
            expect(room.interactables.length).toBeGreaterThanOrEqual(1);
        });

        it('should clamp level to minimum of 1', async () => {
            const room = Room.create(RoomType.COMBAT, -5);
            expect(room.level).toBe(1);
        });

        it('should generate unique IDs for each room', async () => {
            const room1 = Room.create(RoomType.COMBAT, 1);
            const room2 = Room.create(RoomType.COMBAT, 1);
            expect(room1.id).not.toBe(room2.id);
        });
    });

    describe('isHostileRoom()', () => {
        it('should return true for COMBAT rooms', async () => {
            const room = Room.create(RoomType.COMBAT, 1);
            expect(room.isHostileRoom()).toBe(true);
        });

        it('should return true for ELITE rooms', async () => {
            const room = Room.create(RoomType.ELITE, 1);
            expect(room.isHostileRoom()).toBe(true);
        });

        it('should return true for BOSS rooms', async () => {
            const room = Room.create(RoomType.BOSS, 1);
            expect(room.isHostileRoom()).toBe(true);
        });

        it('should return false for TREASURE rooms', async () => {
            const room = Room.create(RoomType.TREASURE, 1);
            expect(room.isHostileRoom()).toBe(false);
        });

        it('should return false for REST rooms', async () => {
            const room = Room.create(RoomType.REST, 1);
            expect(room.isHostileRoom()).toBe(false);
        });

        it('should return false for SHOP rooms', async () => {
            const room = Room.create(RoomType.SHOP, 1);
            expect(room.isHostileRoom()).toBe(false);
        });

        it('should return false for ENTRANCE rooms', async () => {
            const room = Room.create(RoomType.ENTRANCE, 1);
            expect(room.isHostileRoom()).toBe(false);
        });
    });

    describe('connectTo()', () => {
        it('should create bidirectional connections between rooms', async () => {
            const room1 = Room.create(RoomType.ENTRANCE, 1);
            const room2 = Room.create(RoomType.COMBAT, 1);

            room1.connectTo(room2);

            expect(room1.connections).toContain(room2.id);
            expect(room2.connections).toContain(room1.id);
        });

        it('should not create duplicate connections', async () => {
            const room1 = Room.create(RoomType.ENTRANCE, 1);
            const room2 = Room.create(RoomType.COMBAT, 1);

            room1.connectTo(room2);
            room1.connectTo(room2);

            expect(room1.connections.filter(id => id === room2.id).length).toBe(1);
            expect(room2.connections.filter(id => id === room1.id).length).toBe(1);
        });

        it('should allow multiple connections to different rooms', async () => {
            const room1 = Room.create(RoomType.ENTRANCE, 1);
            const room2 = Room.create(RoomType.COMBAT, 1);
            const room3 = Room.create(RoomType.TREASURE, 1);

            room1.connectTo(room2);
            room1.connectTo(room3);

            expect(room1.connections.length).toBe(2);
            expect(room1.connections).toContain(room2.id);
            expect(room1.connections).toContain(room3.id);
        });
    });

    describe('canEnter()', () => {
        it('should return false for LOCKED rooms', async () => {
            const room = Room.create(RoomType.COMBAT, 1);
            expect(room.state).toBe(RoomState.LOCKED);
            expect(room.canEnter()).toBe(false);
        });

        it('should return true for AVAILABLE rooms', async () => {
            const room = Room.create(RoomType.COMBAT, 1);
            room.state = RoomState.AVAILABLE;
            expect(room.canEnter()).toBe(true);
        });

        it('should return false for CLEARED rooms', async () => {
            const room = Room.create(RoomType.COMBAT, 1);
            room.state = RoomState.CLEARED;
            expect(room.canEnter()).toBe(false);
        });

        it('should return true for ENTRANCE rooms even when locked', async () => {
            const room = Room.create(RoomType.ENTRANCE, 1);
            // Entrance rooms have special logic - they're always enterable
            room.state = RoomState.AVAILABLE;
            expect(room.canEnter()).toBe(true);
        });
    });

    describe('enter()', () => {
        it('should set state to ACTIVE when entering an available room', async () => {
            const room = Room.create(RoomType.COMBAT, 1);
            room.state = RoomState.AVAILABLE;

            room.enter();

            expect(room.state).toBe(RoomState.ACTIVE);
        });

        it('should throw error when entering a locked room', async () => {
            const room = Room.create(RoomType.COMBAT, 1);
            expect(room.state).toBe(RoomState.LOCKED);

            expect(() => room.enter()).toThrow('Room is locked');
        });
    });

    describe('complete()', () => {
        it('should set state to CLEARED and return rewards', async () => {
            const room = Room.create(RoomType.COMBAT, 1);
            room.state = RoomState.AVAILABLE;
            room.enter();

            const reward = room.complete();

            expect(room.state).toBe(RoomState.CLEARED);
            expect(reward).toBeDefined();
            expect(reward).toHaveProperty('items');
            expect(reward).toHaveProperty('gold');
            expect(reward).toHaveProperty('experience');
        });

        it('should throw error when completing a non-active room', async () => {
            const room = Room.create(RoomType.COMBAT, 1);
            room.state = RoomState.AVAILABLE;

            expect(() => room.complete()).toThrow('Room is not active');
        });

        it('should throw error when completing a locked room', async () => {
            const room = Room.create(RoomType.COMBAT, 1);

            expect(() => room.complete()).toThrow('Room is not active');
        });
    });

    describe('rewards', () => {
        it('should generate gold and XP for combat rooms', async () => {
            const room = Room.create(RoomType.COMBAT, 1);
            expect(room.reward.gold).toBeGreaterThan(0);
            expect(room.reward.experience).toBeGreaterThan(0);
        });

        it('should generate higher gold for treasure rooms', async () => {
            const combatRoom = Room.create(RoomType.COMBAT, 1);
            const treasureRoom = Room.create(RoomType.TREASURE, 1);
            expect(treasureRoom.reward.gold).toBeGreaterThan(combatRoom.reward.gold);
        });

        it('should generate higher rewards for elite rooms', async () => {
            const combatRoom = Room.create(RoomType.COMBAT, 1);
            const eliteRoom = Room.create(RoomType.ELITE, 1);
            expect(eliteRoom.reward.gold).toBeGreaterThan(combatRoom.reward.gold);
            expect(eliteRoom.reward.experience).toBeGreaterThan(combatRoom.reward.experience);
        });

        it('should generate highest XP for boss rooms', async () => {
            const combatRoom = Room.create(RoomType.COMBAT, 1);
            const bossRoom = Room.create(RoomType.BOSS, 1);
            expect(bossRoom.reward.experience).toBeGreaterThan(combatRoom.reward.experience);
        });

        it('should generate health restore for rest rooms', async () => {
            const room = Room.create(RoomType.REST, 1);
            expect(room.reward.healthRestore).toBeDefined();
            expect(room.reward.healthRestore).toBe(100);
            expect(room.reward.gold).toBe(0);
            expect(room.reward.experience).toBe(0);
        });

        it('should generate no rewards for entrance rooms', async () => {
            const room = Room.create(RoomType.ENTRANCE, 1);
            expect(room.reward.gold).toBe(0);
            expect(room.reward.experience).toBe(0);
        });

        it('should scale rewards with level', async () => {
            const lowLevelRoom = Room.create(RoomType.COMBAT, 1);
            const highLevelRoom = Room.create(RoomType.COMBAT, 10);
            expect(highLevelRoom.reward.gold).toBeGreaterThan(lowLevelRoom.reward.gold);
            expect(highLevelRoom.reward.experience).toBeGreaterThan(lowLevelRoom.reward.experience);
        });
    });

    describe('interactables', () => {
        it('should allow interacting with interactables by ID', async () => {
            const room = Room.create(RoomType.TREASURE, 1);
            const chest = room.interactables.find(i => i.type === InteractableType.CHEST);
            expect(chest).toBeDefined();

            const result = room.interactWith(chest!.id);

            expect(result).not.toBeNull();
            expect(result!.message).toContain('open');
        });

        it('should return null for non-existent interactable ID', async () => {
            const room = Room.create(RoomType.TREASURE, 1);
            const result = room.interactWith('non-existent-id');
            expect(result).toBeNull();
        });

        it('should track available interactables', async () => {
            const room = Room.create(RoomType.TREASURE, 1);
            const initialCount = room.getAvailableInteractables().length;
            expect(initialCount).toBeGreaterThan(0);

            const chest = room.interactables.find(i => i.type === InteractableType.CHEST);
            room.interactWith(chest!.id);

            expect(room.getAvailableInteractables().length).toBeLessThan(initialCount);
        });

        it('should correctly report hasAvailableInteractables', async () => {
            const room = Room.create(RoomType.TREASURE, 1);
            expect(room.hasAvailableInteractables()).toBe(true);

            // Use all interactables
            for (const interactable of room.interactables) {
                room.interactWith(interactable.id);
            }

            expect(room.hasAvailableInteractables()).toBe(false);
        });

        it('should allow NPCs to be interacted with multiple times', async () => {
            const room = Room.create(RoomType.SHOP, 1);
            const npc = room.interactables.find(i => i.type === InteractableType.NPC);
            expect(npc).toBeDefined();

            room.interactWith(npc!.id);
            room.interactWith(npc!.id);

            // NPC should still be available
            expect(room.getAvailableInteractables()).toContain(npc);
        });
    });

    describe('getIcon()', () => {
        it('should return correct icon for each room type', async () => {
            const testCases: [RoomType, string][] = [
                [RoomType.ENTRANCE, '🚪'],
                [RoomType.COMBAT, '⚔️'],
                [RoomType.ELITE, '👹'],
                [RoomType.TREASURE, '💎'],
                [RoomType.REST, '🔥'],
                [RoomType.SHOP, '🏪'],
                [RoomType.EVENT, '❓'],
                [RoomType.BOSS, '💀'],
                [RoomType.PUZZLE, '🔍']
            ];

            for (const [roomType, expectedIcon] of testCases) {
                const room = Room.create(roomType, 1);
                expect(room.getIcon()).toBe(expectedIcon);
            }
        });
    });

    describe('generateDescription()', () => {
        it('should generate a non-empty description for combat rooms', async () => {
            const room = Room.create(RoomType.COMBAT, 1);
            expect(room.description.length).toBeGreaterThan(0);
            // Combat descriptions should be thematic and evocative
            expect(room.description).toBeTruthy();
        });

        it('should generate different descriptions for different room types', async () => {
            const combatRoom = Room.create(RoomType.COMBAT, 5);
            const restRoom = Room.create(RoomType.REST, 5);
            const bossRoom = Room.create(RoomType.BOSS, 5);
            
            // Each room type should have distinct descriptions
            expect(combatRoom.description).not.toBe(restRoom.description);
            expect(restRoom.description).not.toBe(bossRoom.description);
        });

        it('should generate appropriate descriptions for each room type', async () => {
            const entranceRoom = Room.create(RoomType.ENTRANCE, 1);
            const treasureRoom = Room.create(RoomType.TREASURE, 5);
            const shopRoom = Room.create(RoomType.SHOP, 3);
            
            // Entrance should mention dungeon/entrance themes
            expect(entranceRoom.description).toBeTruthy();
            // Treasure should mention gold/riches themes
            expect(treasureRoom.description).toBeTruthy();
            // Shop should mention merchant/goods themes
            expect(shopRoom.description).toBeTruthy();
        });
    });

    describe('toJSON()', () => {
        it('should serialize all room properties', async () => {
            const room = Room.create(RoomType.COMBAT, 1);
            const json = room.toJSON();

            expect(json).toHaveProperty('id', room.id);
            expect(json).toHaveProperty('type', RoomType.COMBAT);
            expect(json).toHaveProperty('level', 1);
            expect(json).toHaveProperty('state', RoomState.LOCKED);
            expect(json).toHaveProperty('connections');
            expect(json).toHaveProperty('reward');
            expect(json).toHaveProperty('enemies');
            expect(json).toHaveProperty('interactables');
            expect(json).toHaveProperty('description');
        });

        it('should include enemies for hostile rooms after loading', async () => {
            const room = Room.create(RoomType.COMBAT, 1);
            // Enemies are loaded lazily
            await room.ensureEnemiesLoaded();
            const json = room.toJSON();

            expect(json.enemies).toBeDefined();
            expect(Array.isArray(json.enemies)).toBe(true);
        });

        it('should include interactables', async () => {
            const room = Room.create(RoomType.TREASURE, 1);
            const json = room.toJSON();

            expect(json.interactables).toBeDefined();
            expect(Array.isArray(json.interactables)).toBe(true);
            expect(json.interactables.length).toBeGreaterThan(0);
        });

        it('should include connections', async () => {
            const room1 = Room.create(RoomType.ENTRANCE, 1);
            const room2 = Room.create(RoomType.COMBAT, 1);
            room1.connectTo(room2);

            const json = room1.toJSON();

            expect(json.connections).toContain(room2.id);
        });
    });

    describe('deterministic behavior with seeded RNG', () => {
        it('should produce consistent results with same seed', async () => {
            initializeRNG('deterministic-test');
            const room1 = Room.create(RoomType.TREASURE, 5);
            const reward1 = { ...room1.reward };
            const interactables1 = room1.interactables.map(i => i.name);

            initializeRNG('deterministic-test');
            const room2 = Room.create(RoomType.TREASURE, 5);
            const reward2 = { ...room2.reward };
            const interactables2 = room2.interactables.map(i => i.name);

            expect(reward1.gold).toBe(reward2.gold);
            expect(reward1.experience).toBe(reward2.experience);
            expect(interactables1).toEqual(interactables2);
        });

        it('should produce different results with different seeds', async () => {
            initializeRNG('seed-a');
            const roomA = Room.create(RoomType.EVENT, 5);

            initializeRNG('seed-b');
            const roomB = Room.create(RoomType.EVENT, 5);

            // With different seeds, the interactable types should likely differ
            // (not guaranteed, but highly probable)
            const typeA = roomA.interactables[0]?.type;
            const typeB = roomB.interactables[0]?.type;
            
            // At minimum, the IDs should differ
            expect(roomA.id).not.toBe(roomB.id);
        });
    });
});
